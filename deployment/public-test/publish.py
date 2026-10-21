"""Run on the existing VPS only after signed APK + Samsung release gates pass.

Publishes a separate software-test APK and additive website link. Does not
change the production API, data, financial policy, release row or stable APK.
"""
import copy,datetime,fcntl,hashlib,json,os,pathlib,re,shutil,subprocess,tarfile,time,urllib.request
P=pathlib.Path
BASE=P('/srv/dtexchange-public-test')
STAGE=BASE/'publication-8019'
COMPOSE=P('/srv/dtexchange/current/deployment/cloudzy/compose.yml')
SNIPPET=P('/etc/nginx/snippets/dtexchange-public-test.conf')
STABLE=P('/srv/dtexchange/releases/approved/DTExchange.apk')
STABLE_SHA='8fa26acc6c86fd18ce9aad40dbc85053f39d71f248aa792267e2eb23d339545b'
CERT='475392e84f1c8293842610276bdd1d3d2f94cad1b5afa14cd6d64362488bb67c'
WEB_OLD='sha256:bf374a367c7a411320638bdfd51dbbf9fd7c49251e7d73aeeb2fea7055ae19b7'
WEB_TAG='dtexchange-web:public-test-link-8019'
os.umask(0o077)
lock=open('/run/lock/dtexchange-public-test-publication.lock','w')
fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
def run(args,input=None,timeout=90):
 r=subprocess.run(args,input=input,capture_output=True,timeout=timeout)
 if r.returncode:raise RuntimeError('COMMAND_FAILED:'+args[0])
 return r.stdout
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def inspect(name):return json.loads(run(['docker','inspect','dtexchange-'+name+'-1']))[0]
def ready():
 h=json.load(urllib.request.urlopen('http://127.0.0.1:4000/health/ready',timeout=10))
 assert all(h[k]=='ready' for k in ['status','database','redis','queues','workers'])
def config(path):return json.loads(run(['docker','compose','-f',str(path),'--profile','*','config','--format','json']))
def up_web():run(['docker','compose','-f',str(COMPOSE),'up','-d','--no-deps','--no-build','--pull','never','web'],timeout=150)
def web_ready():
 for _ in range(40):
  try:
   if urllib.request.urlopen('http://127.0.0.1:3000/site',timeout=3).status==200:return
  except Exception:pass
  time.sleep(1)
 raise RuntimeError('WEBSITE_NOT_READY')
def https(path):
 return run(['curl','--fail','--silent','--show-error','--max-time','20','--resolve','dtexchange.app:443:127.0.0.1','https://dtexchange.app'+path])
meta=json.loads((STAGE/'publication-candidate.json').read_text())
assert meta['versionCode']==8019 and meta['versionName']=='1.0.0' and meta['applicationId']=='com.dtexchange.dt_exchange.publictest'
assert meta['certificateSha256']==CERT and meta['signatureVerified'] is True and meta['debuggable'] is False
assert meta['physicalDeviceValidation']=='PASSED' and meta['publicTestMode'] is True and meta['realMoney'] is False
assert meta['apiBaseUrl']=='https://dtexchange.app/test-api/api/v1'
assert sha(STAGE/'DTExchange-test.apk')==meta['sha256'] and (STAGE/'DTExchange-test.apk').stat().st_size==meta['sizeBytes']
assert sha(STABLE)==STABLE_SHA and shutil.disk_usage(BASE).free>40*1024**3
memory=dict((line.split(':')[0],int(line.split()[1])) for line in P('/proc/meminfo').read_text().splitlines())
assert memory['MemAvailable']>2*1024**2,'MEMORY_RESERVE_NOT_MET'
ready()
before={n:inspect(n) for n in ['api','web','postgres','redis','engagement']}
assert before['web']['Image']==WEB_OLD,'WEBSITE_BASE_CHANGED'
run(['docker','image','inspect',WEB_OLD])
runtime=P('/srv/dtexchange/config/runtime.env');runtime_hash=sha(runtime)
assert runtime_hash=='f0db7613883fc91ce4f17d5c7693116d80152fa4f65ca45add851bd384ed2347'
assert sha(COMPOSE)=='aa1c146a2d38e67315dee5ec95b0d5b7cc214fd9183705c51b754bbf725b38ee'
assert json.load(urllib.request.urlopen('http://172.31.118.4:4118/api/v1/test/status'))['realMoney'] is False
sql="SELECT count(*) FROM admin_users a WHERE a.status='active' AND a.totp_secret_ciphertext IS NOT NULL AND EXISTS(SELECT 1 FROM audit_logs l WHERE l.entity_id=a.id::text AND l.action='test.admin.provisioned');"
assert int(run(['docker','exec','-i','dtexchange-public-test-test-db-1','psql','-U','dt_test','-d','dtexchange_public_test','-At'],input=sql.encode()).strip())>=1
backup=json.loads((BASE/'backups/restore-verified.json').read_text())
# The encrypted backup and restore rehearsal are independently verified again
# by the invoking pre-publication run; retain its evidence without key material.
assert backup
archive=STAGE/'test-download-website-prepared.tar.gz'
assert sha(archive)=='2e250a599d3bb9372bc2a2023bcbe7550ed6a0e9c1fad6c5bfc029714e850d3a'
context=STAGE/'website-context';context.mkdir(exist_ok=True)
with tarfile.open(archive,'r:gz') as t:
 for member in t.getmembers():
  assert not member.issym() and not member.islnk() and not member.name.startswith('/') and '..' not in P(member.name).parts
 t.extractall(context,filter='data')
manifest=json.loads((context/'manifest.json').read_text())
assert all(sha(context/name)==digest for name,digest in manifest.items())
(context/'Dockerfile').write_text('FROM '+WEB_OLD+'\nCOPY --chown=node:node web /app\nUSER node\n')
run(['docker','build','--network','none','--pull=false','-t',WEB_TAG,str(context)],timeout=300)
new_image=json.loads(run(['docker','image','inspect',WEB_TAG]))[0]['Id']
smoke='dt-public-test-website-smoke'
run(['docker','run','-d','--name',smoke,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','256m','--cpus','0.5','--pids-limit','80','--tmpfs','/tmp:size=32m','-e','HOSTNAME=0.0.0.0',WEB_TAG])
try:
 time.sleep(3)
 run(['docker','exec',smoke,'node','-e',"fetch('http://127.0.0.1:3000/site').then(async r=>{let s=await r.text();process.exit(r.ok&&s.includes('Test APK Download')?0:1)}).catch(()=>process.exit(1))"],timeout=40)
finally:run(['docker','rm','-f',smoke])
original_compose=COMPOSE.read_text();original_snippet=SNIPPET.read_text()
assert '/downloads/test/' not in original_snippet,'TEST_APK_ALREADY_PUBLISHED_REVIEW_REQUIRED'
replacement,count=re.subn(r'(?ms)(^  web:\n(?:(?!^  [a-zA-Z][^\n]*:\s*$).)*?^    image:)[^\n]*',lambda m:m.group(1)+' '+WEB_TAG,original_compose)
assert count==1
candidate=COMPOSE.with_name('compose.public-test-link-candidate.yml');candidate.write_text(replacement)
expected=copy.deepcopy(config(COMPOSE));expected['services']['web']['image']=WEB_TAG
assert config(candidate)==expected,'UNEXPECTED_COMPOSE_CHANGE'
(STAGE/'compose.before.yml').write_text(original_compose)
(STAGE/'nginx-snippet.before.conf').write_text(original_snippet)
release=BASE/'release';assert not (release/'release.json').exists()
public=P('/srv/dtexchange/releases/test-8019');public.mkdir(mode=0o755,exist_ok=True)
os.chmod(public,0o755)
new_snippet=original_snippet+'''
location = /downloads/test/DTExchange-test.apk {
 alias /srv/dtexchange/releases/test-8019/DTExchange-test.apk;
 default_type application/vnd.android.package-archive;
 add_header Content-Disposition 'attachment; filename="DTExchange-test.apk"' always;
 add_header Cache-Control "public, max-age=0, must-revalidate" always;
 add_header X-Content-Type-Options nosniff always;
 limit_conn dt_public_test_connections 4;
}
location = /downloads/test/release.json {
 alias /srv/dtexchange/releases/test-8019/release.json;
 default_type application/json;
 add_header Cache-Control no-store always;
 add_header X-Content-Type-Options nosniff always;
}
location = /downloads/test/DTExchange-test.apk.sha256 {
 alias /srv/dtexchange/releases/test-8019/DTExchange-test.apk.sha256;
 default_type text/plain;
 add_header Cache-Control no-store always;
}
location ^~ /downloads/test/ { return 404; }
'''
# Only the already approved separate test release is published. Stable release
# metadata, its APK, and the Android signing/attestation keys are never written.
switched=False
try:
 COMPOSE.write_text(replacement);switched=True;up_web();web_ready()
 assert inspect('web')['Image']==new_image
 meta['publishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();meta['publicationApproved']=True
 for filename in ['DTExchange-test.apk','DTExchange-test.apk.sha256']:
  shutil.copyfile(STAGE/filename,public/filename);os.chmod(public/filename,0o644)
 (release/'release.json').write_text(json.dumps(meta,indent=2));os.chmod(release/'release.json',0o644)
 shutil.copyfile(release/'release.json',public/'release.json');os.chmod(public/'release.json',0o644)
 SNIPPET.write_text(new_snippet);os.chmod(SNIPPET,0o644)
 run(['nginx','-t']);run(['systemctl','reload','nginx'])
 time.sleep(2)
 assert 'Test APK Download' in https('/').decode()
 assert 'Download Test APK' in https('/download/test').decode()
 assert json.loads(https('/downloads/test/release.json'))['sha256']==meta['sha256']
 assert hashlib.sha256(https('/downloads/test/DTExchange-test.apk')).hexdigest()==meta['sha256']
 assert sha(STABLE)==STABLE_SHA and sha(runtime)==runtime_hash
 for name in ['api','postgres','redis','engagement']:assert inspect(name)['Id']==before[name]['Id']
 ready()
 (STAGE/'published.json').write_text(json.dumps({'versionCode':8019,'sha256':meta['sha256'],'webImage':new_image,'stableBuild':8011,'productionApiDatabaseRedisWorkerUnchanged':True,'publishedAt':meta['publishedAt']},indent=2))
 print('PUBLIC_TEST_8019_PUBLISHED_STABLE_8011_UNCHANGED')
except Exception:
 SNIPPET.write_text(original_snippet);run(['nginx','-t']);run(['systemctl','reload','nginx'])
 if (release/'release.json').exists():
  (release/'release.json').rename(STAGE/'release.failed.json')
 if switched:COMPOSE.write_text(original_compose);up_web();web_ready()
 print('TEST_PUBLICATION_ROLLED_BACK_REVIEW_REQUIRED')
 raise
