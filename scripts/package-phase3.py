"""Package Phase 3 source, evidence and documentation; exclude credentials/build outputs."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import hashlib,json,shutil
root=Path(__file__).resolve().parents[1];out=root.parent
exclude_dirs={'node_modules','.next','dist','build','.dart_tool','.git','.gradle','.idea','Pods','.symlinks','ephemeral','__pycache__','.tooling','.swiftpm'}
exclude_names={'package-receipt.json','.DS_Store','.flutter-plugins','.flutter-plugins-dependencies','local.properties','Generated.xcconfig','flutter_export_environment.sh','GeneratedPluginRegistrant.h','GeneratedPluginRegistrant.m','GeneratedPluginRegistrant.java','SourceManifest.json','SOURCE_MANIFEST.json'}
files=[]
for p in sorted(root.rglob('*')):
 if not p.is_file() or p.is_symlink():continue
 rel=p.relative_to(root)
 if any(part in exclude_dirs for part in rel.parts):continue
 if p.name in exclude_names or p.suffix in {'.iml','.pyc','.tsbuildinfo','.zip'}:continue
 if p.name.startswith('.env') and p.name!='.env.example':continue
 if p.suffix=='.log' and not rel.as_posix().startswith(('docs/phase2/validation/','docs/phase3/validation/')):continue
 files.append(p)
manifest={'product':'DT Exchange','phase':3,'scope':'Connected application foundation; no real deposits, custody or payouts','files':[{'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in files]}
path=root/'SOURCE_MANIFEST.json';path.write_text(json.dumps(manifest,indent=2)+'\n');files.append(path)
archive=out/'DT_Exchange_Phase3.zip'
with ZipFile(archive,'w',ZIP_DEFLATED,compresslevel=9)as z:
 for p in files:z.write(p,Path('dt-exchange')/p.relative_to(root))
with ZipFile(archive)as z:
 assert z.testzip() is None
 assert not any('/.env' in n and not n.endswith('/.env.example') for n in z.namelist())
 for record in manifest['files']:assert hashlib.sha256(z.read('dt-exchange/'+record['path'])).hexdigest()==record['sha256']
for name in ['Phase3_Implementation_Summary.md','Phase3_API_Documentation.md','Phase3_Test_Results.md']:shutil.copyfile(root/'docs/phase3'/name,out/name)
print(json.dumps({'archive':str(archive),'files':len(files),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()},indent=2))
