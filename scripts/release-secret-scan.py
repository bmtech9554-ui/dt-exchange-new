"""Scan source or a release ZIP without printing discovered secret values."""
from pathlib import Path
import sys,re,json,zipfile,os
excluded={'node_modules','.git','.next','dist','build','.dart_tool','.gradle','Pods','ephemeral','__pycache__'}
patterns=[('private_key',re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')),('aws_key',re.compile(rb'AKIA[A-Z0-9]{16}')),('github_token',re.compile(rb'gh[pousr]_[A-Za-z0-9]{36,}')),('jwt_literal',re.compile(rb'eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}'))]
findings=[];count=0
# Detect any configured secrets also copied verbatim into release material; do not print them.
values=[v.encode() for k,v in os.environ.items() if re.search(r'(SECRET|PRIVATE_KEY|API_KEY|PASSWORD|CREDENTIAL)',k) and len(v)>=16 and 'CODEX' not in k]
def check(name,data):
 global count
 count+=1;p=Path(name)
 if (p.name.startswith('.env') and p.name!='.env.example') or p.suffix.lower() in {'.pem','.key','.p12','.pfx','.jks','.keystore','.mobileprovision'}:findings.append({'path':name,'issue':'prohibited_release_file'})
 for label,pattern in patterns:
  if pattern.search(data):findings.append({'path':name,'issue':label})
 if any(v in data for v in values):findings.append({'path':name,'issue':'configured_secret_literal'})
target=Path(sys.argv[1] if len(sys.argv)>1 else '.')
if target.is_file():
 with zipfile.ZipFile(target) as z:
  for entry in z.infolist():
   if not entry.is_dir():check(entry.filename,z.read(entry))
else:
 for directory,dirs,files in os.walk(target):
  dirs[:]=[d for d in dirs if d not in excluded and not (Path(directory)/d).is_symlink()]
  for name in files:
   p=Path(directory)/name
   if not p.is_symlink() and p.suffix not in {'.zip','.tsbuildinfo'}:check(str(p.relative_to(target)),p.read_bytes())
print(json.dumps({'filesScanned':count,'findings':findings,'gitHistory':'NOT_AVAILABLE' if not (target/'.git').exists() else 'SEPARATE_HISTORY_SCAN_REQUIRED','scope':'Byte patterns, prohibited file names, configured secret literals. No claim to identify every unknown credential or text embedded in raster images.'},indent=2))
sys.exit(1 if findings else 0)
