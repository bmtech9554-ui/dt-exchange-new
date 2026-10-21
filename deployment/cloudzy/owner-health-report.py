#!/usr/bin/env python3
"""Publish non-secret backup metadata for the authenticated owner console."""
import datetime,hashlib,json,pathlib
root=pathlib.Path('/srv/dtexchange/backups')
now=datetime.datetime.now(datetime.timezone.utc)
files=sorted(root.glob('*.dump.age'))
report={'checkedAt':now.isoformat(),'backupStatus':'failed','lastSuccessfulBackup':None}
if files:
 latest=files[-1]
 try:
  expected=latest.with_name(latest.name+'.sha256').read_text().split()[0]
  with latest.open('rb') as source: digest=hashlib.file_digest(source,'sha256').hexdigest()
  updated=datetime.datetime.fromtimestamp(latest.stat().st_mtime,datetime.timezone.utc)
  if digest==expected:
   report.update(lastSuccessfulBackup=updated.isoformat(),backupStatus='healthy' if (now-updated).total_seconds()<172800 else 'stale')
 except (OSError,ValueError,IndexError):pass
out=pathlib.Path('/srv/dtexchange/status/owner-health.json')
out.parent.mkdir(mode=0o755,exist_ok=True)
temporary=out.with_suffix('.tmp');temporary.write_text(json.dumps(report));temporary.chmod(0o644);temporary.replace(out)
