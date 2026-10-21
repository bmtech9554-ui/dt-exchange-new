"""Staged collector; no provisioning, source deletion, financial writes or key creation.

Full bounded snapshots include current/rotated files; overlap is intentional.
An oversized source fails with no checkpoint advance, never silently truncates.
No claim of lossless coverage under the existing Docker size-only retention.
"""
import json
import os
from pathlib import Path
import shutil
import sys
import time
from archive import IndiaS3, MAX_BYTES, command, exclusive_write, private_directory, require, seal

def collect(config):
    import fcntl  # VPS Linux only; archive/recovery core is portable.
    remote = IndiaS3(config)
    remote.preflight()  # Missing/unapproved destination: no log capture/transfers.
    spool = private_directory(config['spool'])
    with open(spool/'collector.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        require(shutil.disk_usage(spool).free >= config['minimumFreeBytes'], 'DISK_SPACE_LOW')
        require(sum(p.stat().st_size for p in spool.rglob('*') if p.is_file()) < config['maximumSpoolBytes'], 'SPOOL_LIMIT_REACHED')
        # Preserve encrypted captures on failures and retry them first. A remote
        # success without a local receipt can cause a duplicate immutable version,
        # never deletion or loss of the previously uploaded object.
        for p in sorted(spool.glob('*.tar.gz.age')):
            if not Path(str(p)+'.remote.json').exists():
                remote.upload(p, json.loads(Path(str(p)+'.json').read_text()))
        sources, total = {}, 0
        def add(name, data):
            nonlocal total
            total += len(data)
            require(total <= MAX_BYTES, 'CAPTURE_LIMIT_REACHED')
            sources[name] = data
        for folder, pattern in [('/var/log/nginx','*.log*'),('/var/log','auth.log*'),('/var/log','syslog*'),('/var/log','fail2ban.log*'),('/srv/dtexchange/logs','*.log*')]:
            for p in sorted(Path(folder).glob(pattern)):
                require(p.is_file() and not p.is_symlink(), 'UNSAFE_LOG_SOURCE')
                require(p.stat().st_size + total <= MAX_BYTES, 'CAPTURE_LIMIT_REACHED')
                with p.open('rb') as source:
                    add('files/'+str(p).lstrip('/'), source.read(MAX_BYTES-total+1))
        require(any(n.endswith('auth.log') for n in sources), 'AUTH_LOG_MISSING')
        require(any('/nginx/' in n for n in sources), 'NGINX_LOG_MISSING')
        # json-file paths come from Docker inspection, not user-supplied input.
        # Include each rotated file. Reading never rotates/truncates the source.
        for name in ['api','web','engagement','postgres','redis']:
            c = json.loads(command(['docker','inspect','dtexchange-'+name+'-1']))[0]
            p = Path(c['LogPath'])
            require(c['HostConfig']['LogConfig']['Type'] == 'json-file' and p.is_absolute() and
                    str(p).startswith('/var/lib/docker/containers/') and p.is_file(), 'DOCKER_LOG_SOURCE_UNSUPPORTED')
            for f in sorted(p.parent.glob(p.name+'*')):
                require(f.is_file() and not f.is_symlink() and f.stat().st_size + total <= MAX_BYTES, 'DOCKER_CAPTURE_LIMIT')
                with f.open('rb') as source:
                    add('docker/'+name+'/'+f.name, source.read(MAX_BYTES-total+1))
        add('journal/system.jsonl', command(['journalctl','--since=-24h','--output=json','--no-pager']))
        # Authentication/audit records are encrypted separately with longer
        # retention. No raw database rows are written to disk or stdout here.
        records = command(['docker','exec','-i','-u','node','dtexchange-api-1','node'],
                          Path(__file__).with_name('export-records.cjs').read_bytes())
        require(len(records) <= MAX_BYTES, 'RECORD_CAPTURE_LIMIT')
        json.loads(records)  # Refuse incomplete/failed exports.
        for kind, payload in [('ict', sources), ('records', {'database/security-records.json': records})]:
            path, receipt = seal(payload, spool, config['recipientFile'], kind)
            remote.upload(path, receipt)
        # Append-only health checkpoints. No destructive retention job exists.
        exclusive_write(spool/('success-'+str(time.time_ns())+'.json'), json.dumps({'completedAt': time.time(),'classes':['ict','records']}).encode())
    return {'event':'log_archive_verified','classes':2}

if __name__ == '__main__':
    os.umask(0o077)
    try:
        print(json.dumps(collect(json.loads(Path(sys.argv[1]).read_text()))))
    except Exception:
        print('{"event":"log_archive_failed","needsOperator":true}')
        raise SystemExit(1)
