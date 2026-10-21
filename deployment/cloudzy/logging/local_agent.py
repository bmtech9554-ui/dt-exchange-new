"""Bounded, sanitized local-VPS collection. No network storage or source deletion.

Checkpoints advance only after age authentication and manifest verification.
Raw messages, request URLs/bodies, credentials and arbitrary database JSON are
never archived. Original logs and authoritative database backups are retained.
"""
import copy
from datetime import datetime, timedelta, timezone
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import sys
import time
import uuid

from archive import command, private_directory, recover, require, seal

MIB = 1024**2
UUID = re.compile(r'^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$', re.I)
OPERATIONS = {'admin_login', 'user_login', 'otp_verify', 'session_refresh', 'protected_request','manual_deposit_submit'}


def timestamp(value):
    if isinstance(value, str) and re.fullmatch(r'\d{4}-\d\d-\d\d[T ][0-9:.]+(?:Z|[+-]\d\d:\d\d)', value):
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00')).isoformat()
        except ValueError:
            pass
    return None


def sanitize(line, source):
    """Strict allowlist. Even JSON fields with familiar names are untrusted."""
    result = {'source': source, 'event': 'unstructured_metadata_only'}
    if len(line) > 65536:
        return {**result, 'event': 'oversized_line_suppressed'}
    text = line.decode('utf-8', errors='replace')
    when = timestamp(text.split(' ',1)[0])
    if when:
        result['time'] = when
    try:
        obj = json.loads(text)
        if isinstance(obj, dict) and 'log' in obj:
            when = timestamp(obj.get('time'))
            if when:
                result['time'] = when
            text = obj['log'] if isinstance(obj['log'], str) else ''
            try:
                obj = json.loads(text)
            except (ValueError, TypeError):
                obj = None
        if isinstance(obj, dict):
            event = obj.get('event')
            if event in {'http_request', 'security_auth_result', 'security_request_rejected','security_deposit_conflict'}:
                result['event'] = event
                for key, allowed in [('operation', OPERATIONS), ('result', {'accepted', 'rejected','conflict'}),
                                     ('method', {'GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'})]:
                    if isinstance(obj.get(key), str) and obj[key] in allowed:
                        result[key] = obj[key]
                if isinstance(obj.get('requestId'), str) and UUID.fullmatch(obj['requestId']):
                    result['requestId'] = obj['requestId']
                if type(obj.get('status')) is int and 100 <= obj['status'] <= 599:
                    result['status'] = obj['status']
                if type(obj.get('duration')) in (int, float) and 0 <= obj['duration'] <= 86400000:
                    result['durationMs'] = round(obj['duration'])
                return result
            # Safe Nginx JSON: only bounded method/status/timing. Never URI/query/IP.
            if source == 'nginx' and str(obj.get('status', '')).isdigit():
                status = int(obj['status'])
                if 100 <= status <= 599:
                    result.update(event='http_access', status=status)
                    when=timestamp(obj.get('time'))
                    if when:result['time']=when
                    if obj.get('method') in ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']:
                        result['method']=obj['method']
                    if type(obj.get('duration')) in (float,int) and 0<=obj['duration']<=86400:
                        result['durationMs']=round(obj['duration']*1000)
                    return result
    except (ValueError, TypeError):
        pass
    # Default combined-log format. Deliberately discard URL, agent and referrer.
    match = re.search(r'"(GET|POST|HEAD|PUT|PATCH|DELETE|OPTIONS) [^\r\n]* HTTP/[0-9.]+" ([1-5][0-9]{2}) ', text)
    if source == 'nginx' and match:
        result.update(event='http_access', method=match[1], status=int(match[2]))
    elif source in {'auth', 'syslog', 'fail2ban'}:
        for marker, event in [('Failed password', 'ssh_auth_failed'), ('Accepted publickey', 'ssh_key_accepted'),
                              ('Accepted password', 'ssh_password_accepted'), ('Invalid user', 'ssh_invalid_user'),
                              ('authentication failure', 'auth_failed'), (' Ban ', 'security_ban'),
                              (' Unban ', 'security_unban'), ('session opened', 'session_opened'),
                              ('session closed', 'session_closed')]:
            if marker in text:
                result['event'] = event
                break
    # Counts/classification only for free-form errors: secret-safe, not full forensics.
    return result


def atomic_json(path, value):
    path = Path(path)
    require(not path.is_symlink(), 'SYMLINK_STATE_REFUSED')
    temporary = path.with_name('.' + path.name + '.' + uuid.uuid4().hex)
    try:
        with open(os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as out:
            json.dump(value, out, sort_keys=True)
            out.flush()
            os.fsync(out.fileno())
        os.replace(temporary, path)
        if os.name != 'nt':
            fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(fd)
            finally:
                os.close(fd)
    finally:
        if temporary.exists():
            temporary.unlink()  # Only this invocation's incomplete state, never logs.


def chunk(path, previous, source, limit=MIB):
    """Rename-aware cursor; compression is a new source and may safely duplicate.

    Incomplete last lines wait for append. Oversized lines are suppressed in chunks.
    A copied/truncated source is recaptured rather than silently skipped.
    """
    path = Path(path)
    require(not path.is_symlink() and stat.S_ISREG(path.stat().st_mode), 'UNSAFE_LOG_SOURCE')
    flags = os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0)
    with os.fdopen(os.open(path, flags), 'rb') as raw:
        st = os.fstat(raw.fileno())
        identity = f'{st.st_dev}:{st.st_ino}'
        compressed = path.suffix == '.gz'
        stream = gzip.GzipFile(fileobj=raw) if compressed else raw
        try:
            old = previous.get(identity, {})
            prefix_len = old.get('prefixLength', 256)
            prefix = stream.read(prefix_len)
            reset = (old.get('prefix') != hashlib.sha256(prefix).hexdigest()
                     or (not compressed and old.get('offset', 0) > st.st_size))
            offset = 0 if reset else old.get('offset', 0)
            stream.seek(offset)
            data = stream.read(limit)
            eof = not stream.read(1)
            if data and not data.endswith(b'\n'):
                last = data.rfind(b'\n')
                if last >= 0:
                    data = data[:last+1]
                elif len(data) < limit and not compressed:
                    data = b''
                # Full oversized line chunks never archive their content.
                eof = False
            events = [sanitize(line, source) for line in data.splitlines()]
            cursor = {'offset': offset+len(data), 'prefix': hashlib.sha256(prefix).hexdigest(),
                      'prefixLength': len(prefix) or 256, 'lastSeen': time.time(), 'complete': eof,
                      'source': source, 'compressed': compressed}
            return identity, cursor, events, len(data)
        finally:
            if compressed:
                stream.close()


def discover():
    sources = []
    for base, pattern, kind in [('/var/log/nginx', '*.log*', 'nginx'),('/var/log','auth.log*','auth'),
          ('/var/log','syslog*','syslog'),('/var/log','fail2ban.log*','fail2ban'),
          ('/srv/dtexchange/logs','*.log*','operations'),('/var/log','dtexchange-*.log*','operations')]:
        sources.extend((p, kind) for p in sorted(Path(base).glob(pattern)) if p.is_file())
    for name in ['api','web','engagement','postgres','redis']:
        item = json.loads(command(['docker','inspect','dtexchange-'+name+'-1']))[0]
        require(item['HostConfig']['LogConfig']['Type'] == 'json-file', 'DOCKER_LOG_DRIVER_CHANGED')
        p = Path(item['LogPath'])
        require(str(p).startswith('/var/lib/docker/containers/'), 'UNEXPECTED_DOCKER_LOG_PATH')
        sources.extend((f, 'docker_'+name) for f in sorted(p.parent.glob(p.name+'*')) if f.is_file())
    return sources


def capacity(config, folder):
    usage = shutil.disk_usage(folder)
    used = sum(p.stat().st_size for p in Path(folder).rglob('*') if p.is_file())
    reserve = config['minimumFreeBytes']
    require(type(reserve) is int and reserve >= 10*1024**3, 'DISK_RESERVE_TOO_LOW')
    require(usage.free >= reserve + 256*MIB, 'DISK_RESERVE_REACHED')
    require(used + 256*MIB < config['archiveBudgetBytes'], 'ARCHIVE_BUDGET_REACHED')
    return {'diskFreeBytes': usage.free, 'archiveBytes': used}


def collect(config, sources=None, database=None, age='age'):
    require(config.get('enabled') is True, 'LOCAL_LOGGING_NOT_APPROVED_OR_ENABLED')
    require(type(config.get('retentionDays')) is int and config['retentionDays'] >= 180,
            'RETENTION_MINIMUM_180_DAYS')
    folder = private_directory(config['archiveDirectory'])
    state_folder = private_directory(config['stateDirectory'])
    counters = capacity(config, folder)
    state_path = state_folder/'checkpoint.json'
    state = json.loads(state_path.read_text()) if state_path.exists() else {'files': {}, 'database': {}}
    next_state = copy.deepcopy(state)
    events, seen, consumed = [], set(), 0
    source_list = discover() if sources is None else sources
    # Fair rotation: oldest last-read first. Bounds are independent of log volume.
    def rank(item):
        st = item[0].stat()
        return state['files'].get(f'{st.st_dev}:{st.st_ino}', {}).get('lastSeen', 0)
    for path, kind in sorted(source_list, key=rank):
        if consumed >= 8*MIB:
            break
        identity, cursor, rows, size = chunk(path, state['files'], kind)
        seen.add(identity)
        next_state['files'][identity] = cursor
        events.extend(rows)
        consumed += size
    present = {f'{p.stat().st_dev}:{p.stat().st_ino}' for p, _ in source_list}
    lost = [k for k,v in state['files'].items() if k not in present and not v['complete']]
    # Missing unread source is a sticky gap, never a false success.
    next_state['captureGap'] = bool(lost) or state.get('captureGap', False)
    # Keep cursor metadata bounded; completed disappeared sources no longer needed.
    next_state['files'] = {k:v for k,v in next_state['files'].items() if k in present or not v['complete']}
    db = database(state.get('database', {})) if database else {'records': [], 'cursor': {}}
    next_state['database'] = db['cursor']
    recent=state.get('recentSecurity',{})
    for event in events:
        if event.get('time') and (event.get('result') in {'rejected','conflict'} or event['event'] in {'ssh_auth_failed','ssh_invalid_user'}):
            occurred=datetime.fromisoformat(event['time']).timestamp()
            if time.time()-900<=occurred<=time.time()+30:
                key=event.get('requestId') or str(uuid.uuid4())
                recent[key]={'at':occurred,'type':event.get('operation',event['event'])}
    # Bound state even under attack; saturation is itself an alertable burst.
    recent={k:v for k,v in recent.items() if v['at']>=time.time()-900}
    next_state['recentSecurity']=dict(sorted(recent.items(),key=lambda item:item[1]['at'])[-10000:])
    counts={}
    for value in next_state['recentSecurity'].values():
        counts[value['type']]=counts.get(value['type'],0)+1
    payload = {'events.jsonl': b''.join(json.dumps(e, sort_keys=True).encode()+b'\n' for e in events),
               'records.json': json.dumps(db['records'], sort_keys=True).encode()}
    # Make idle periods verifiable without manufacturing application events.
    payload['capture.json'] = json.dumps({'capturedAt': time.time(), 'sourceCount': len(source_list),
        'bytesRead': consumed, 'events': len(events), 'gap': next_state['captureGap']}).encode()
    archive, receipt = seal(payload, folder, config['recipientFile'], 'ict', age=age)
    verified = recover(archive, receipt['sha256'], config['identityFile'], age=age)
    require(verified['verified'], 'RECOVERY_VERIFICATION_FAILED')
    receipt.update(localVerified=True, retentionDays=config['retentionDays'],
                   retainUntil=(datetime.now(timezone.utc)+timedelta(days=config['retentionDays'])).isoformat())
    atomic_json(str(archive)+'.json', receipt)
    next_state['lastSuccess'] = time.time()
    atomic_json(state_path, next_state)
    status = {**counters, 'checkedAt': time.time(), 'lastSuccess': next_state['lastSuccess'],
              'captureGap': next_state['captureGap'], 'sourceCount': len(source_list),
              'events': len(events), 'databaseRecords': len(db['records']), 'bytesRead': consumed,
              'backlogSources': sum(not v['complete'] for v in next_state['files'].values()),
              'retentionDays': config['retentionDays'], 'archiveVerified': True,
              'securityFailures15m':counts,
              'location': 'EXISTING_CLOUDZY_VPS_NOT_INDIA_VERIFIED'}
    atomic_json(state_folder/'archive-status.json', status)
    return status


def database_page(cursor):
    script = Path(__file__).with_name('local-records.cjs').read_text()
    output = command(['docker','exec','-i','-u','node','dtexchange-api-1','node','-e',script], json.dumps(cursor).encode())
    require(len(output) < 4*MIB, 'DATABASE_PAGE_TOO_LARGE')
    return json.loads(output)


if __name__ == '__main__':
    try:
        config = json.loads(Path(sys.argv[1]).read_text())
        result = collect(config, database=database_page)
        print(json.dumps({'event':'local_archive_verified', 'events':result['events'],
                          'records':result['databaseRecords'], 'gap':result['captureGap']}))
    except Exception as error:
        # No exception contents, file paths, raw database errors or secret values.
        allowed = {'DISK_RESERVE_REACHED','ARCHIVE_BUDGET_REACHED','LOCAL_LOGGING_NOT_APPROVED_OR_ENABLED'}
        code = str(error) if str(error) in allowed else 'LOCAL_ARCHIVE_FAILED'
        print(json.dumps({'event':'local_archive_failed','code':code}))
        raise SystemExit(1)
