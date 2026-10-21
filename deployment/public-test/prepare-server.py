"""Create only the approved, separate Cloudzy public-test stack. No publication."""
import base64,hashlib,json,os,pathlib,secrets,shutil,subprocess,time,urllib.request
P=pathlib.Path
root=P('/srv/dtexchange-public-test')
package=P('/srv/dtexchange-public-test-package')
def run(args,**kwargs):
 r=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,**kwargs)
 if r.returncode:raise RuntimeError('TEST_SETUP_COMMAND_FAILED: '+args[0]+' '+str(r.stderr[-1500:].decode(errors='replace')))
 return r.stdout
def snapshot():
 return {name:json.loads(run(['docker','inspect','dtexchange-'+name+'-1']))[0]['Id'] for name in ['api','web','postgres','redis','engagement']}
before=snapshot()
assert shutil.disk_usage('/srv').free>40*1024**3
memory={l.split(':')[0]:int(l.split()[1])*1024 for l in P('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')}
assert memory['MemAvailable']>2*1024**3,'INSUFFICIENT_TEST_MEMORY_RESERVE'
health=json.load(urllib.request.urlopen('http://127.0.0.1:4000/health/ready',timeout=15))
assert all(health.get(k)=='ready' for k in ['status','database','redis','queues','workers'])
assert hashlib.sha256(P('/srv/dtexchange/releases/approved/DTExchange.apk').read_bytes()).hexdigest()=='8fa26acc6c86fd18ce9aad40dbc85053f39d71f248aa792267e2eb23d339545b'
manifest=json.loads((package/'manifest.json').read_text())
for name,digest in manifest.items():
 p=(package/name).resolve();assert p.is_relative_to(package) and p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()==digest,'PACKAGE_MISMATCH'
root.mkdir(mode=0o700,exist_ok=True)
for name in ['secrets','data','release','backups']:(root/name).mkdir(mode=0o700,exist_ok=True)
# The public release directory contains no private data or configuration.
os.chmod(root/'release',0o755)
runtime=root/'secrets/runtime.json'
if not runtime.exists():
 password=secrets.token_urlsafe(40)
 dbpw=root/'secrets/database-password';dbpw.write_text(password);os.chmod(dbpw,0o444)
 private=run(['openssl','genpkey','-algorithm','RSA','-pkeyopt','rsa_keygen_bits:2048'])
 public=run(['openssl','pkey','-pubout'],input=private)
 cfg={'NODE_ENV':'test','PUBLIC_TEST_MODE':'true','PUBLIC_TEST_REAL_MONEY':'false','PUBLIC_TEST_ORIGIN':'https://dtexchange.app','PORT':'4118','DATABASE_URL':'postgresql://dt_test:'+password+'@test-db:5432/dtexchange_public_test','PG_POOL_MAX':'4','CORS_ORIGINS':'https://dtexchange.app','TRUST_PROXY_CIDR':'172.31.118.0/24','JWT_PRIVATE_KEY_B64':base64.b64encode(private).decode(),'JWT_PUBLIC_KEY_B64':base64.b64encode(public).decode(),'TRON_PROVIDER':'mock','TRON_NETWORK':'tron-mock','TRON_REQUIRED_CONFIRMATIONS':'3','OTP_PROVIDER':'dev','DEV_OTP_EXPOSE':'true','VERIFICATION_PROVIDER':'mock','RATE_PROVIDER':'mock','PAYOUT_PROVIDER':'mock','MANUAL_DEPOSIT_REVIEW':'true','MANUAL_PAYOUT':'true','AUTOMATED_BLOCKCHAIN_CREDIT':'false','AUTOMATED_PAYOUT':'false','TRANSACTIONS_ENABLED':'true','PAYOUTS_ENABLED':'true','REFERRAL_PROGRAM_PAUSED':'true','MANUAL_COLLECTION_ADDRESS':'DT-TEST-NONPAYABLE-NO-REAL-USDT','PAYOUT_MAX_AMOUNT':'51500000','OWNER_WALLET_ADJUSTMENTS_ENABLED':'false','REFERRAL_REWARD_RELEASE_ENABLED':'false'}
 for key in ['DATA_ENCRYPTION_KEY','LOOKUP_HASH_KEY','OTP_HASH_KEY']:cfg[key]=base64.b64encode(secrets.token_bytes(32)).decode()
 runtime.write_text(json.dumps(cfg));os.chown(runtime,1000,1000);os.chmod(runtime,0o400)
shutil.copyfile(package/'deployment/public-test/compose.yml',root/'compose.yml')
os.chmod(root/'compose.yml',0o600)
shutil.copyfile(package/'deployment/public-test/network-boundary.sh',root/'network-boundary.sh')
os.chmod(root/'network-boundary.sh',0o700)
shutil.copyfile(package/'deployment/public-test/dtexchange-public-test-boundary.service',P('/etc/systemd/system/dtexchange-public-test-boundary.service'))
run(['systemctl','daemon-reload'])
run(['systemctl','enable','--now','dtexchange-public-test-boundary.service'])
run(['docker','build','--network=none','-f','deployment/public-test/Dockerfile.api','-t','dtexchange-public-test-api:8019','.'],cwd=package)
run(['docker','build','--network=none','-f','deployment/public-test/Dockerfile.web','-t','dtexchange-public-test-web:8019','.'],cwd=package)
compose=['docker','compose','-f',str(root/'compose.yml')]
run(compose+['up','-d','test-db'])
for attempt in range(30):
 ready=subprocess.run(compose+['exec','-T','test-db','pg_isready','-U','dt_test','-d','dtexchange_public_test'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 if ready.returncode==0:break
 time.sleep(1)
else:raise RuntimeError('TEST_DATABASE_NOT_READY')
run(['docker','run','--rm','--network','dtexchange-public-test_isolated','--memory=256m','--cpus=0.5','--pids-limit=100','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges:true','--mount','type=bind,src='+str(runtime)+',dst=/test-secrets/runtime.json,readonly','dtexchange-public-test-api:8019','initialize'])
run(compose+['up','-d','test-api','test-web'])
for attempt in range(30):
 try:
  s=json.load(urllib.request.urlopen('http://172.31.118.4:4118/api/v1/test/status',timeout=3))
  if s.get('realMoney') is False:break
 except Exception:pass
 time.sleep(1)
else:raise RuntimeError('TEST_API_NOT_READY')
assert urllib.request.urlopen('http://172.31.118.3:3000/test-admin',timeout=10).status==200
assert snapshot()==before,'PRODUCTION_SERVICE_REPLACED'
report={'testStackPrepared':True,'publicRoutesOpened':False,'apkPublished':False,'productionContainerIdsUnchanged':True,'images':{service:run(['docker','image','inspect','--format','{{.Id}}','dtexchange-public-test-'+service+':8019']).decode().strip() for service in ['api','web']}}
(root/'prepared.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
