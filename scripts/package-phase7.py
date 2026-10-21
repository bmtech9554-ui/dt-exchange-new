"""Package Phase 7 without replacing earlier phase archives or manifests."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import os,hashlib,json,shutil
root=Path(__file__).resolve().parents[1];out=root.parent
excluded={'node_modules','.next','dist','build','.dart_tool','.git','.gradle','.idea','Pods','.symlinks','ephemeral','__pycache__','.tooling','.swiftpm'}
skip={'package-receipt.json','.DS_Store','.flutter-plugins','.flutter-plugins-dependencies','local.properties','Generated.xcconfig','flutter_export_environment.sh','GeneratedPluginRegistrant.h','GeneratedPluginRegistrant.m','GeneratedPluginRegistrant.java','PHASE7_SOURCE_MANIFEST.json','key.properties'}
files=[]
for directory,dirs,names in os.walk(root):
 dirs[:]=[d for d in dirs if d not in excluded and not (Path(directory)/d).is_symlink()]
 for name in names:
  p=Path(directory)/name;rel=p.relative_to(root)
  if p.is_symlink() or name in skip or p.suffix in {'.iml','.pyc','.tsbuildinfo','.zip','.pem','.key','.p12','.jks','.keystore'}:continue
  if name.startswith('.env') and name!='.env.example':continue
  if p.suffix=='.log' and not str(rel).startswith('docs/'):continue
  files.append(p)
files.sort()
manifest={'product':'DT Exchange','phase':7,'productionDeployed':False,'releaseGate':'Real provider adapters, live infrastructure, restore drills and signed native acceptance remain required','files':[{'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in files]}
mp=root/'PHASE7_SOURCE_MANIFEST.json';mp.write_text(json.dumps(manifest,indent=2)+'\n');files.append(mp)
archive=out/'DT_Exchange_Phase7_Final.zip'
with ZipFile(archive,'w',ZIP_DEFLATED,compresslevel=9)as z:
 for p in files:z.write(p,Path('dt-exchange')/p.relative_to(root))
with ZipFile(archive)as z:
 assert z.testzip() is None
 for record in manifest['files']:assert hashlib.sha256(z.read('dt-exchange/'+record['path'])).hexdigest()==record['sha256']
 assert not any('/.env' in n and not n.endswith('/.env.example') for n in z.namelist())
for p in sorted((root/'docs/phase7').glob('Phase7_*.md')):shutil.copyfile(p,out/p.name)
shutil.copyfile(root/'docs/phase7/Phase7_Admin_Preview.html',out/'Phase7_Admin_Preview.html')
receipt={'archive':str(archive),'files':len(files),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
(out/'Phase7_Package_Receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
