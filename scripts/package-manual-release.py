"""Package the manual Android update; never overwrite earlier phase artifacts."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import os,hashlib,json,shutil
root=Path(__file__).resolve().parents[1];out=root.parent
excluded={'node_modules','.next','dist','build','.dart_tool','.git','.gradle','.idea','Pods','.symlinks','ephemeral','__pycache__','.tooling','.swiftpm','artifacts'}
skip={'package-receipt.json','.DS_Store','.flutter-plugins','.flutter-plugins-dependencies','local.properties','Generated.xcconfig','flutter_export_environment.sh','GeneratedPluginRegistrant.h','GeneratedPluginRegistrant.m','GeneratedPluginRegistrant.java','MANUAL_ANDROID_SOURCE_MANIFEST.json','key.properties'}
files=[]
for directory,dirs,names in os.walk(root):
 dirs[:]=[d for d in dirs if d not in excluded and not (Path(directory)/d).is_symlink()]
 for name in names:
  p=Path(directory)/name;rel=p.relative_to(root)
  if p.is_symlink() or name in skip or p.suffix.lower() in {'.iml','.pyc','.tsbuildinfo','.zip','.pem','.key','.p12','.pfx','.jks','.keystore','.cer','.crt','.mobileprovision','.apk','.aab'}:continue
  if name.startswith('.env') and name!='.env.example':continue
  if p.suffix=='.log' and not str(rel).startswith('docs/'):continue
  if '/validation/' in str(rel) and 'initial' in name:continue
  files.append(p)
files.sort()
manifest={'product':'DT Exchange','release':'1.0.0-manual.1','operatingModel':'MANUAL_ANDROID','certification':'BLOCKED_FOR_PRODUCTION','mobileVersion':'1.0.0+8002','productionDeployed':False,'realTransfersPerformed':False,'signedApkProduced':False,'files':[{'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in files]}
mp=root/'MANUAL_ANDROID_SOURCE_MANIFEST.json';mp.write_text(json.dumps(manifest,indent=2)+'\n');files.append(mp)
archive=out/'DT_Exchange_Manual_Android_Release.zip'
with ZipFile(archive,'w',ZIP_DEFLATED,compresslevel=9) as z:
 for p in files:z.write(p,Path('dt-exchange')/p.relative_to(root))
with ZipFile(archive) as z:
 assert z.testzip() is None
 for f in manifest['files']:assert hashlib.sha256(z.read('dt-exchange/'+f['path'])).hexdigest()==f['sha256']
 assert not any('/.env' in n and not n.endswith('/.env.example') for n in z.namelist())
for p in sorted((root/'docs/manual').glob('*.md')):shutil.copyfile(p,out/p.name)
checksum=hashlib.sha256(archive.read_bytes()).hexdigest()
(out/(archive.name+'.sha256')).write_text(checksum+'  '+archive.name+'\n')
receipt={'archive':archive.name,'release':'1.0.0-manual.1','files':len(files),'bytes':archive.stat().st_size,'sha256':checksum,'certification':'BLOCKED_FOR_PRODUCTION','nativeArtifacts':[]}
(out/'Manual_Android_Package_Receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
