"""Same-host technical monitoring; no external webhook/SMS or financial action.

Journal + root-only status + existing permission-filtered Owner inbox. A host
outage cannot alert from that same host; no off-server availability claim.
"""
import json
import hashlib
from pathlib import Path
import shutil
import sys
import time
import urllib.request
from archive import command, private_directory, require
from local_agent import atomic_json
from monitor import evaluate


def local_codes(signals, config, now):
    codes = set(evaluate(signals, now))
    if signals.get('diskFree', 0) < config['minimumFreeBytes'] + 5*1024**3:
        codes.add('DISK_CAPACITY_LOW')
    if signals.get('archiveBytes', 0) >= config['archiveBudgetBytes']*.8:
        codes.add('ARCHIVE_BUDGET_WARNING')
    if signals.get('captureGap'):
        codes.add('ARCHIVE_CAPTURE_GAP')
    if signals.get('backlogSources', 0) and now-signals.get('backlogSince', now) >= 900:
        codes.add('ARCHIVE_BACKLOG')
    if not signals.get('loggingServicesHealthy'):
        codes.add('LOGGING_SERVICE_FAILED')
    if not signals.get('sshProtectionHealthy'):
        codes.add('SSH_SECURITY_SERVICE_FAILED')
    if not signals.get('integrityHealthy'):
        codes.add('ARCHIVE_INTEGRITY_FAILED')
    failures=signals.get('securityFailures15m',{})
    if failures.get('admin_login',0)>=5:codes.add('ADMIN_AUTH_FAILURE_BURST')
    if failures.get('ssh_auth_failed',0)+failures.get('ssh_invalid_user',0)>=10:codes.add('SSH_AUTH_FAILURE_BURST')
    if failures.get('manual_deposit_submit',0)>=5:codes.add('DEPOSIT_CONFLICT_BURST')
    return sorted(codes)


def deliver(codes, config, now):
    require(config.get('adminInboxEnabled') is True, 'INBOX_ALERTS_NOT_ENABLED')
    script = Path(__file__).with_name('local-alert.cjs').read_text()
    data = json.dumps({'codes': codes, 'bucket': int(now//900)}).encode()
    result = json.loads(command(['docker','exec','-i','-u','node','dtexchange-api-1','node','-e',script], data))
    require(result.get('delivered') is True, 'INBOX_DELIVERY_FAILED')


def active(name):
    try:
        return command(['systemctl','is-active',name]).strip() == b'active'
    except Exception:
        return False


def gather(config, previous):
    signals = json.loads(command(['docker','exec','-i','-u','node','dtexchange-api-1','node'],
                                 Path(__file__).with_name('monitor-query.cjs').read_bytes()))
    try:
        with urllib.request.urlopen('http://127.0.0.1:4000/health/ready',timeout=10) as r:
            ready=json.load(r)
            signals['apiReady']=all(ready.get(k)=='ready' for k in ['status','database','redis','queues','workers'])
    except Exception:
        signals['apiReady']=False
    signals['clockSynchronized']=command(['timedatectl','show','-p','NTPSynchronized','--value']).strip()==b'yes'
    backups=sorted(Path('/srv/dtexchange/backups').glob('*.dump.age'),key=lambda p:p.stat().st_mtime)
    signals['backupAt']=0
    if backups:
        newest=backups[-1]
        companion=Path(str(newest)+'.sha256')
        if companion.exists():
            with newest.open('rb') as src:
                verified=hashlib.file_digest(src,'sha256').hexdigest()==companion.read_text().split()[0]
            if verified:signals['backupAt']=newest.stat().st_mtime
    archive = Path(config['stateDirectory'])/'archive-status.json'
    status = json.loads(archive.read_text()) if archive.exists() else {}
    signals.update({k: status.get(k, 0) for k in ['archiveBytes','backlogSources']})
    signals['captureGap']=status.get('captureGap',False)
    signals['securityFailures15m']=status.get('securityFailures15m',{}) if time.time()-status.get('checkedAt',0)<300 else {}
    signals['archiveAt']=status.get('lastSuccess',0)
    signals['backlogSince']=previous.get('backlogSince',time.time()) if signals['backlogSources'] else 0
    signals['diskFree']=shutil.disk_usage(config['archiveDirectory']).free
    signals['loggingServicesHealthy']=all(active(s) for s in ['rsyslog','dtexchange-local-archive.timer',
                                                             'dtexchange-local-integrity.timer'])
    signals['sshProtectionHealthy']=all(active(s) for s in ['ssh','fail2ban'])
    verified=Path(config['stateDirectory'])/'integrity-status.json'
    integrity=json.loads(verified.read_text()) if verified.exists() else {}
    signals['integrityHealthy']=integrity.get('ok') is True and time.time()-integrity.get('checkedAt',0)<48*3600
    fills=[]
    for name in ['api','web','engagement','postgres','redis']:
        c=json.loads(command(['docker','inspect','dtexchange-'+name+'-1']))[0]
        p=Path(c['LogPath'])
        require(c['HostConfig']['LogConfig']=={'Type':'json-file','Config':{'max-file':'5','max-size':'10m'}},
                'LOGGING_POLICY_REVIEW_REQUIRED')
        fills.append(sum(f.stat().st_size for f in p.parent.glob(p.name+'*'))/(50*1024**2))
    signals['dockerMaxFill']=max(fills)
    return signals


def main(config):
    require(config.get('enabled') is True, 'MONITOR_NOT_APPROVED_OR_ENABLED')
    state=private_directory(config['stateDirectory'])
    path=state/'monitor-status.json'
    previous=json.loads(path.read_text()) if path.exists() else {}
    now=time.time()
    try:
        signals=gather(config,previous)
        codes=local_codes(signals,config,now)
    except Exception:
        signals={}
        codes=['MONITOR_EXECUTION_FAILED']
    last=state/'alert-delivered.json'
    delivered=json.loads(last.read_text()) if last.exists() else {}
    changed=delivered.get('codes')!=codes
    needed=(codes and (changed or now-delivered.get('sentAt',0)>=900)) or (changed and bool(delivered.get('codes')))
    sent=False
    if needed:
        try:
            deliver(codes or ['RECOVERED'],config,now)
            atomic_json(last,{'sentAt':now,'codes':codes})
            sent=True
        except Exception:
            # Remains pending and retries on the next run. No swallowed delivery.
            codes=sorted(set(codes+['MONITOR_EXECUTION_FAILED']))
    result={'checkedAt':now,'codes':codes,'signals':signals,'deliveryPending':bool(needed and not sent),
            'backlogSince':signals.get('backlogSince',0)}
    atomic_json(path,result)
    # This optional, non-secret projection uses the existing read-only Owner
    # health mount. Never expose the private collector state or archive paths.
    if config.get('ownerHealthFile'):
        public=Path(config['ownerHealthFile'])
        atomic_json(public,{'status':'attention' if codes else 'healthy','checkedAt':now,
          'codes':codes,'deliveryPending':result['deliveryPending'],'retentionDays':config['retentionDays'],
          'lastArchiveAt':signals.get('archiveAt',0),'archiveBytes':signals.get('archiveBytes',0),
          'diskFreeBytes':signals.get('diskFree',0),'indiaStorageVerified':False})
        public.chmod(0o644)
    # Safe status codes only. syslog/journald is also the local fallback alert sink.
    print(json.dumps({'event':'technical_monitor','codes':codes,'deliveryPending':result['deliveryPending']}))
    return result


if __name__=='__main__':
    try:
        main(json.loads(Path(sys.argv[1]).read_text()))
    except Exception:
        print('{"event":"technical_monitor_failed","code":"MONITOR_EXECUTION_FAILED"}')
        raise SystemExit(1)
