"""Technical alerts only; never blocks a user or changes financial/risk policy."""
import json
from pathlib import Path
import shutil
import sys
import time
import urllib.request
from urllib.parse import urlparse
from archive import command, exclusive_write, private_directory, require

def evaluate(signals, now):
    codes = []
    for key, code in [('apiReady','API_NOT_READY'),('workerCurrent','WORKER_STALE'),
                      ('clockSynchronized','CLOCK_UNSYNCED'),('automationDisabled','AUTOMATION_FLAG_DRIFT')]:
        if signals.get(key) is not True: codes.append(code)
    if signals.get('ledgerIntegrityIssues', -1) != 0: codes.append('LEDGER_INTEGRITY_REVIEW')
    if signals.get('failedLogins15m', 0) >= 10: codes.append('AUTH_FAILURE_BURST')
    if signals.get('openHighRisk', 0) > 0: codes.append('OPEN_HIGH_RISK_REVIEW')
    if signals.get('referralsHeld', 0) > 0: codes.append('REFERRAL_REVIEW_PENDING')
    if now-signals.get('backupAt', 0) > 48*3600: codes.append('BACKUP_STALE')
    if now-signals.get('archiveAt', 0) > 30*60: codes.append('ARCHIVE_STALE')
    if signals.get('diskFree', 0) < 2*1024**3: codes.append('DISK_CAPACITY_LOW')
    if signals.get('dockerMaxFill', 1) >= .5: codes.append('DOCKER_CAPTURE_HEADROOM_LOW')
    return sorted(codes)

def deliver(codes, config):
    """Prepared webhook transport; no messages are sent before explicit activation."""
    require(config.get('alertsEnabled') is True, 'ALERT_DELIVERY_NOT_CONFIGURED')
    url = config.get('alertUrl','')
    parsed = urlparse(url)
    require(parsed.scheme == 'https' and parsed.hostname == config.get('approvedAlertHost') and
            not parsed.username and not parsed.password and not parsed.query and not parsed.fragment,
            'APPROVED_HTTPS_ALERT_ENDPOINT_REQUIRED')
    token = Path(config['alertTokenFile']).read_text().strip()
    require(token and '\n' not in token and '\r' not in token, 'INVALID_ALERT_CREDENTIAL')
    data = json.dumps({'service':'dtexchange','event':'technical_monitor','codes':codes}).encode()
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs): return None
    # Default verified system TLS context. No redirects/credentials forwarded.
    opener = urllib.request.build_opener(NoRedirect)
    request = urllib.request.Request(url, data, {'Authorization':'Bearer '+token,'Content-Type':'application/json'})
    with opener.open(request, timeout=15) as response:
        require(200 <= response.status < 300, 'ALERT_DELIVERY_FAILED')

def main(config):
    require(config.get('enabled') is True, 'MONITOR_NOT_APPROVED_OR_ENABLED')
    signals = json.loads(command(['docker','exec','-i','-u','node','dtexchange-api-1','node'], Path(__file__).with_name('monitor-query.cjs').read_bytes()))
    try:
        with urllib.request.urlopen('http://127.0.0.1:4000/health/ready',timeout=10) as r:
            ready=json.load(r)
            signals['apiReady']=all(ready.get(k)=='ready' for k in ['status','database','redis','queues','workers'])
    except Exception: signals['apiReady']=False
    signals['clockSynchronized']=command(['timedatectl','show','-p','NTPSynchronized','--value']).strip()==b'yes'
    signals['backupAt']=max((p.stat().st_mtime for p in Path('/srv/dtexchange/backups').glob('*.dump.age')),default=0)
    signals['archiveAt']=max((p.stat().st_mtime for p in Path(config['spool']).glob('success-*.json')),default=0)
    signals['diskFree']=shutil.disk_usage(config['spool']).free
    fills=[]
    for name in ['api','web','engagement','postgres','redis']:
        c=json.loads(command(['docker','inspect','dtexchange-'+name+'-1']))[0]
        p=Path(c['LogPath'])
        # Current production limit is 5 * 10MiB. Any changed driver/size requires review.
        require(c['HostConfig']['LogConfig']=={'Type':'json-file','Config':{'max-file':'5','max-size':'10m'}}, 'LOGGING_POLICY_REVIEW_REQUIRED')
        fills.append(sum(f.stat().st_size for f in p.parent.glob(p.name+'*'))/(50*1024**2))
    signals['dockerMaxFill']=max(fills)
    codes=evaluate(signals,time.time())
    folder=private_directory(config['spool'])
    exclusive_write(folder/('monitor-'+str(time.time_ns())+'.json'),json.dumps({'checkedAt':time.time(),'codes':codes}).encode())
    previous=sorted(folder.glob('alert-delivered-*.json'))
    last=json.loads(previous[-1].read_text()) if previous else {}
    should_send=bool(codes) and (last.get('codes')!=codes or time.time()-last.get('sentAt',0)>900)
    if should_send:
        deliver(codes,config)
        exclusive_write(folder/('alert-delivered-'+str(time.time_ns())+'.json'),json.dumps({'sentAt':time.time(),'codes':codes}).encode())
    return {'event':'technical_monitor_checked','alertCodes':codes,'delivery':'sent' if should_send else 'not_needed'}

if __name__=='__main__':
    config={}
    try:
        config=json.loads(Path(sys.argv[1]).read_text())
        print(json.dumps(main(config)))
    except Exception:
        # Database/collector failures must also reach the configured on-call sink.
        # A separately hosted dead-man check is still needed for host/network loss.
        if config.get('enabled') is True:
            try: deliver(['MONITOR_EXECUTION_FAILED'],config)
            except Exception: pass
        print('{"event":"technical_monitor_failed","needsOperator":true}')
        raise SystemExit(1)
