"""Create RC1 source archive without replacing any prior phase archive/manifest."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import os,hashlib,json,shutil
root=Path(__file__).resolve().parents[1];out=root.parent
excluded={'node_modules','.next','dist','build','.dart_tool','.git','.gradle','.idea','Pods','.symlinks','ephemeral','__pycache__','.tooling','.swiftpm'}
skip={'package-receipt.json','.DS_Store','.flutter-plugins','.flutter-plugins-dependencies','local.properties','Generated.xcconfig','flutter_export_environment.sh','GeneratedPluginRegistrant.h','GeneratedPluginRegistrant.m','GeneratedPluginRegistrant.java','PHASE8_SOURCE_MANIFEST.json','key.properties'}
files=[]
for directory,dirs,names in os.walk(root):
 dirs[:]=[d for d in dirs if d not in excluded and not (Path(directory)/d).is_symlink()]
 for name in names:
  p=Path(directory)/name;rel=p.relative_to(root)
  if p.is_symlink() or name in skip or p.suffix.lower() in {'.iml','.pyc','.tsbuildinfo','.zip','.pem','.key','.p12','.pfx','.jks','.keystore','.cer','.crt','.mobileprovision'}:continue
  if name.startswith('.env') and name!='.env.example':continue
  if p.suffix=='.log' and not str(rel).startswith('docs/'):continue
  if str(rel).startswith('docs/phase8/validation/') and 'initial' in name:continue
  files.append(p)
files.sort()
manifest={'product':'DT Exchange RC1','version':'1.0.0-rc.1','phase':8,'certification':'BLOCKED_FOR_PRODUCTION','productionDeployed':False,'files':[{'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in files]}
mp=root/'PHASE8_SOURCE_MANIFEST.json';mp.write_text(json.dumps(manifest,indent=2)+'\n');files.append(mp)
archive=out/'DT_Exchange_Phase8_Release_Candidate.zip'
with ZipFile(archive,'w',ZIP_DEFLATED,compresslevel=9)as z:
 for p in files:z.write(p,Path('dt-exchange')/p.relative_to(root))
with ZipFile(archive)as z:
 assert z.testzip() is None
 for record in manifest['files']:assert hashlib.sha256(z.read('dt-exchange/'+record['path'])).hexdigest()==record['sha256']
 assert not any('/.env' in n and not n.endswith('/.env.example') for n in z.namelist())
for p in sorted((root/'docs/phase8').glob('*.md')):shutil.copyfile(p,out/p.name)
receipt={'archive':archive.name,'version':'1.0.0-rc.1','files':len(files),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'manifest':'dt-exchange/PHASE8_SOURCE_MANIFEST.json','certification':'BLOCKED_FOR_PRODUCTION','nativeArtifacts':[]}
(out/'Phase8_Package_Receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
