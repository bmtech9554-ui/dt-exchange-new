"""Resource guard and encrypted recovery for the isolated public-test database."""
import datetime,hashlib,json,os,pathlib,shutil,subprocess,sys,uuid
P=pathlib.Path;root=P('/srv/dtexchange-public-test');backups=root/'backups';dbcontainer='dtexchange-public-test-test-db-1'
def run(a,**k):return subprocess.run(a,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,**k).stdout
def sql(q,dbname='dtexchange_public_test'):
 return run(['docker','exec',dbcontainer,'psql','-v','ON_ERROR_STOP=1','-U','dt_test','-d',dbname,'-Atc',q]).decode().strip()
def guard():
 if shutil.disk_usage(root).free<40*1024**3:
  run(['docker','pause','dtexchange-public-test-test-api-1']);raise RuntimeError('TEST_INTAKE_PAUSED_DISK_RESERVE')
 if int(sql("SELECT pg_database_size(current_database())"))>5*1024**3:
  run(['docker','pause','dtexchange-public-test-test-api-1']);raise RuntimeError('TEST_INTAKE_PAUSED_STORAGE_CAP')
 if sql("SELECT value->>'mode' FROM system_settings WHERE key='public_software_test'")!='PUBLIC_SOFTWARE_TEST':raise RuntimeError('TEST_DATABASE_MARKER_MISSING')
def pipeline(left,right):
 a=subprocess.Popen(left,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 try:
  b=subprocess.run(right,stdin=a.stdout,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);a.stdout.close()
  if a.wait()!=0 or b.returncode:raise RuntimeError('ENCRYPTED_TEST_BACKUP_PIPELINE_FAILED')
 finally:
  if a.poll() is None:a.terminate();a.wait()
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
def backup():
 guard();key=root/'secrets/backup.agekey'
 if not key.exists():run(['age-keygen','-o',str(key)]);os.chmod(key,0o600)
 recipient=run(['age-keygen','-y',str(key)]).decode().strip()
 if sum(p.stat().st_size for p in backups.glob('public-test-*.dump.age'))>2*1024**3:raise RuntimeError('TEST_BACKUP_BUDGET_REVIEW_REQUIRED')
 path=backups/('public-test-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.dump.age')
 pipeline(['docker','exec',dbcontainer,'pg_dump','-U','dt_test','-d','dtexchange_public_test','-Fc'],['age','-r',recipient,'-o',str(path)])
 os.chmod(path,0o600);digest=sha(path);P(str(path)+'.sha256').write_text(digest+'\n');os.chmod(str(path)+'.sha256',0o600)
 pipeline(['age','-d','-i',str(key),str(path)],['docker','exec','-i',dbcontainer,'pg_restore','--file=/dev/null'])
 result={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'archive':path.name,'sha256':digest,'authenticatedDecryptAndFullParse':True}
 (backups/'latest.json').write_text(json.dumps(result));return result
def restore_check():
 guard();meta=json.loads((backups/'latest.json').read_text());path=backups/meta['archive'];assert path.parent==backups and path.name.startswith('public-test-') and sha(path)==meta['sha256']
 target='public_test_recovery_'+uuid.uuid4().hex[:12]
 run(['docker','exec',dbcontainer,'createdb','-U','dt_test',target])
 try:
  pipeline(['age','-d','-i',str(root/'secrets/backup.agekey'),str(path)],['docker','exec','-i',dbcontainer,'pg_restore','--exit-on-error','-U','dt_test','-d',target])
  assert sql("SELECT value->>'mode' FROM system_settings WHERE key='public_software_test'",target)=='PUBLIC_SOFTWARE_TEST'
  assert sql('SELECT count(*) FROM ledger_integrity_issues',target)=='0'
  result={'isolatedRestorePassed':True,'ledgerIntegrityIssues':0,'restoredTestUsers':int(sql('SELECT count(*) FROM users',target)),'productionDatabaseAccessed':False}
  (backups/'restore-verified.json').write_text(json.dumps(result));return result
 finally:
  assert target.startswith('public_test_recovery_') and len(target)==33
  run(['docker','exec',dbcontainer,'dropdb','-U','dt_test',target])
try:
 action=sys.argv[1]
 if action=='backup':result=backup()
 elif action=='restore-check':result=restore_check()
 else:
  guard();result={'diskReserveGiB':40,'testDatabaseBelow5GiB':True}
  for service in ['api','db','web']:
   state=json.loads(run(['docker','inspect','dtexchange-public-test-test-'+service+'-1']))[0]['State']
   if not state['Running'] or state.get('Health',{}).get('Status')!='healthy':raise RuntimeError('TEST_SERVICE_UNHEALTHY_'+service)
  latest=backups/'latest.json'
  if not latest.exists() or (datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(json.loads(latest.read_text())['createdAt'])).total_seconds()>90000:raise RuntimeError('TEST_BACKUP_STALE')
  result['servicesHealthy']=True;result['backupFresh']=True
 print(json.dumps(result))
except Exception as e:
 print(json.dumps({'event':'PUBLIC_TEST_OPERATIONS_REVIEW_REQUIRED','reason':str(e) if isinstance(e,RuntimeError) else type(e).__name__}));sys.exit(1)
