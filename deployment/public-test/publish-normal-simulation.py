"""VPS-only, gated normal-app simulation publication. Never enables real funds.

Stage verified APK, website archive, release.json and validation.json in
/srv/dtexchange-public-test/publication-8021. No signing material is needed.
"""
import copy,fcntl,hashlib,json,os,pathlib,re,shutil,subprocess,tarfile,time,urllib.request
P=pathlib.Path
ROOT=P('/srv/dtexchange-public-test');STAGE=ROOT/'publication-8021'
COMPOSE=P('/srv/dtexchange/current/deployment/cloudzy/compose.yml')
APK=P('/srv/dtexchange/releases/approved/DTExchange.apk')
OLD_SHA='8fa26acc6c86fd18ce9aad40dbc85053f39d71f248aa792267e2eb23d339545b'
CERT='475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c'
TAG='dtexchange-web:normal-simulation-8021'
os.umask(0o077)
lock=open('/run/lock/dtexchange-normal-simulation-publication.lock','w')
fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
def run(args,**kw):
 r=subprocess.run(args,capture_output=True,**kw)
 if r.returncode:raise RuntimeError('COMMAND_FAILED:'+args[0])
 return r.stdout
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def inspect(name):return json.loads(run(['docker','inspect','dtexchange-'+name+'-1']))[0]
def health():
 h=json.load(urllib.request.urlopen('http://127.0.0.1:4000/health/ready',timeout=10))
 assert all(h[k]=='ready' for k in ['status','database','redis','queues','workers'])
def config(p):return json.loads(run(['docker','compose','-f',str(p),'--profile','*','config','--format','json']))
def up():run(['docker','compose','-f',str(COMPOSE),'up','-d','--no-deps','--no-build','--pull','never','web'],timeout=150)
def https(path):return run(['curl','--fail','--silent','--show-error','--max-time','40','--resolve','dtexchange.app:443:127.0.0.1','https://dtexchange.app'+path])
def wait_web():
 for _ in range(45):
  try:
   if urllib.request.urlopen('http://127.0.0.1:3000/download',timeout=3).status==200:return
  except Exception:pass
  time.sleep(1)
 raise RuntimeError('WEBSITE_NOT_HEALTHY')
meta=json.loads((STAGE/'release.json').read_text());evidence=json.loads((STAGE/'validation.json').read_text())
assert meta['latestVersionCode']==8021 and meta['latestVersion']=='1.0.0'
assert meta['applicationId']=='com.dtexchange.dt_exchange' and meta['certificateSha256']==CERT
assert meta['signatureVerified'] is True and meta['debuggable'] is False
assert meta['simulation'] is True and meta['realMoney'] is False
assert meta['physicalDeviceValidation']=='PASSED' and evidence['physicalDeviceValidation']=='PASSED'
assert evidence['apkSha256']==meta['sha256'] and evidence['releaseAuthorized'] is True
assert all(evidence[k] is True for k in ['isolationVerified','demoLedgerVerified','adminWorkflowVerified','userReceiptVerified'])
assert meta['apiBaseUrl']=='https://dtexchange.app/test-api/api/v1'
assert meta['apkUrl']=='https://dtexchange.app/downloads/DTExchange.apk' and meta['downloadUrl']=='https://dtexchange.app/download'
assert sha(STAGE/'DTExchange.apk')==meta['sha256'] and (STAGE/'DTExchange.apk').stat().st_size==int(meta['sizeBytes'])
assert sha(APK)==OLD_SHA and shutil.disk_usage(ROOT).free>40*1024**3
assert next(int(s.split()[1]) for s in P('/proc/meminfo').read_text().splitlines() if s.startswith('MemAvailable:'))>2*1024**2
health();before={n:inspect(n) for n in ['api','web','postgres','redis','engagement']}
runtime=P('/srv/dtexchange/config/runtime.env');runtime_sha=sha(runtime)
original=COMPOSE.read_text();baseline=config(COMPOSE)
run(['docker','image','inspect',before['web']['Image']])
assert json.load(urllib.request.urlopen('http://172.31.118.4:4118/api/v1/test/status'))['realMoney'] is False
q="SELECT count(*) FROM admin_users a WHERE status='active' AND totp_secret_ciphertext IS NOT NULL AND EXISTS(SELECT 1 FROM audit_logs l WHERE l.entity_id=a.id::text AND l.action='test.admin.provisioned');"
assert int(run(['docker','exec','-i','dtexchange-public-test-test-db-1','psql','-U','dt_test','-d','dtexchange_public_test','-At'],input=q.encode()))>=1
for action in ['backup','restore-check','monitor']:run(['python3',str(ROOT/'operations.py'),action],timeout=150)
archive=STAGE/'website.tar.gz';assert sha(archive)==evidence['websiteSha256']
context=STAGE/'website-context';context.mkdir(exist_ok=True)
with tarfile.open(archive,'r:gz') as t:
 for m in t.getmembers():assert not m.issym() and not m.islnk() and not m.name.startswith('/') and '..' not in P(m.name).parts
 t.extractall(context,filter='data')
manifest=json.loads((context/'manifest.json').read_text());assert all(sha(context/n)==h for n,h in manifest.items())
shutil.copyfile(STAGE/'release.json',context/'release.json');os.chmod(context/'release.json',0o644)
(context/'Dockerfile').write_text('FROM '+before['web']['Image']+'\nCOPY --chown=node:node web /app\nCOPY --chown=node:node release.json /app/release/simulation.json\nENV DT_SIMULATION_RELEASE_FILE=/app/release/simulation.json\nUSER node\n')
run(['docker','build','--network=none','--pull=false','-t',TAG,str(context)],timeout=300)
newimage=json.loads(run(['docker','image','inspect',TAG]))[0]['Id']
smoke='dt-normal-simulation-smoke'
run(['docker','run','-d','--name',smoke,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','256m','--cpus','0.5','--pids-limit','80','--tmpfs','/tmp:size=32m','-e','HOSTNAME=0.0.0.0',TAG])
try:
 time.sleep(4)
 run(['docker','exec',smoke,'node','-e',"fetch('http://127.0.0.1:3000/download').then(async r=>{const s=await r.text();process.exit(r.ok&&s.includes('8021')&&s.includes('SIMULATION')&&s.includes('"+meta['sha256']+"')?0:1)}).catch(()=>process.exit(1))"],timeout=45)
finally:run(['docker','rm','-f',smoke])
replacement,n=re.subn(r'(?ms)(^  web:\n(?:(?!^  [a-zA-Z][^\n]*:\s*$).)*?^    image:)[^\n]*',lambda m:m.group(1)+' '+TAG,original)
assert n==1
candidate=COMPOSE.with_name('compose.normal-simulation-candidate.yml');candidate.write_text(replacement)
expected=copy.deepcopy(baseline);expected['services']['web']['image']=TAG;assert config(candidate)==expected
rollback=STAGE/'rollback';rollback.mkdir(mode=0o700,exist_ok=True)
(rollback/'compose.yml').write_text(original)
shutil.copyfile(APK,rollback/'DTExchange-8011.apk');assert sha(rollback/'DTExchange-8011.apk')==OLD_SHA
checksum=P(str(APK)+'.sha256');oldchecksum=checksum.read_bytes() if checksum.exists() else None
(rollback/'rollback.json').write_text(json.dumps({'previousImage':before['web']['Image'],'previousApkSha256':OLD_SHA,'runtimeSha256':runtime_sha}))
try:
 # Atomic APK replacement; immutable old artifact is retained outside public paths.
 staged=APK.with_suffix('.apk.next');shutil.copyfile(STAGE/'DTExchange.apk',staged);os.chmod(staged,0o644);os.replace(staged,APK)
 checksum.write_text(meta['sha256']+'  DTExchange.apk\n');os.chmod(checksum,0o644)
 COMPOSE.write_text(replacement);up();wait_web()
 assert inspect('web')['Image']==newimage
 page=https('/download').decode();assert '8021' in page and meta['sha256'] in page and 'SIMULATION' in page
 assert hashlib.sha256(https('/downloads/DTExchange.apk')).hexdigest()==meta['sha256']
 assert 'Test APK Download' not in https('/').decode()
 assert sha(runtime)==runtime_sha
 for name in ['api','postgres','redis','engagement']:assert inspect(name)['Id']==before[name]['Id']
 health()
 (STAGE/'published.json').write_text(json.dumps({'build':8021,'sha256':meta['sha256'],'webImage':newimage,'productionFinancialServicesUnchanged':True,'rollback8011Verified':True}))
 print('NORMAL_SIMULATION_BUILD_8021_PUBLISHED')
except Exception:
 staged=APK.with_suffix('.apk.rollback');shutil.copyfile(rollback/'DTExchange-8011.apk',staged);os.chmod(staged,0o644);os.replace(staged,APK)
 if oldchecksum is not None:checksum.write_bytes(oldchecksum)
 COMPOSE.write_text(original);up();wait_web();assert sha(APK)==OLD_SHA
 print('PUBLICATION_ROLLED_BACK_TO_8011_REVIEW_REQUIRED')
 raise
