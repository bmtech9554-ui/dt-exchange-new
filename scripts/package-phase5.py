"""Package Phase 5 source, evidence and documentation; exclude credentials/build outputs."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import hashlib,json,shutil
root=Path(__file__).resolve().parents[1];out=root.parent
exclude_dirs={'node_modules','.next','dist','build','.dart_tool','.git','.gradle','.idea','Pods','.symlinks','ephemeral','__pycache__','.tooling','.swiftpm'}
exclude_names={'package-receipt.json','.DS_Store','.flutter-plugins','.flutter-plugins-dependencies','local.properties','Generated.xcconfig','flutter_export_environment.sh','GeneratedPluginRegistrant.h','GeneratedPluginRegistrant.m','GeneratedPluginRegistrant.java','SourceManifest.json','SOURCE_MANIFEST.json'}
phase5_logs={'backend-build.log','backend-tests.log','flutter-tests.log','flutter-phase5.log','flutter-previews.log','flutter-analyze.log','build-all.log','flutter-web-build.log','flutter-android-build.log','tokens.log','typecheck.log','admin-build.log','flutter-version.log','browser-install.log'}
files=[]
for p in sorted(root.rglob('*')):
 if not p.is_file() or p.is_symlink():continue
 rel=p.relative_to(root)
 if any(part in exclude_dirs for part in rel.parts):continue
 if rel.as_posix().startswith('docs/phase5/validation/') and p.suffix=='.log' and p.name not in phase5_logs:continue
 if rel.as_posix().startswith('docs/phase4/validation/') and p.suffix=='.log' and p.name not in {'backend-build.log','backend-tests.log','flutter-tests.log','flutter-phase4.log','flutter-previews.log','flutter-analyze.log','build-all.log','flutter-web-build.log','flutter-android-build.log','tokens.log','typecheck.log'}:continue
 if p.name in exclude_names or p.suffix in {'.iml','.pyc','.tsbuildinfo','.zip'}:continue
 if p.name.startswith('.env') and p.name!='.env.example':continue
 if p.suffix=='.log' and not rel.as_posix().startswith(('docs/phase2/validation/','docs/phase3/validation/','docs/phase4/validation/','docs/phase5/validation/')):continue
 files.append(p)
manifest={'product':'DT Exchange','phase':5,'scope':'Sandbox payout lifecycle, settlement, reversal, reconciliation; no real INR transfer','files':[{'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in files]}
path=root/'SOURCE_MANIFEST.json';path.write_text(json.dumps(manifest,indent=2)+'\n');files.append(path)
archive=out/'DT_Exchange_Phase5.zip'
with ZipFile(archive,'w',ZIP_DEFLATED,compresslevel=9)as z:
 for p in files:z.write(p,Path('dt-exchange')/p.relative_to(root))
with ZipFile(archive)as z:
 assert z.testzip() is None
 assert not any('/.env' in n and not n.endswith('/.env.example') for n in z.namelist())
 for record in manifest['files']:assert hashlib.sha256(z.read('dt-exchange/'+record['path'])).hexdigest()==record['sha256']
for name in ['Phase5_Implementation_Summary.md','Phase5_Payout_Architecture.md','Phase5_Reconciliation_Design.md','Phase5_API_Documentation.md','Phase5_Test_Results.md']:shutil.copyfile(root/'docs/phase5'/name,out/name)
shutil.copyfile(root/'docs/phase5/DT_Exchange_Phase5_UI_Preview.png',out/'DT_Exchange_Phase5_UI_Preview.png')
shutil.copyfile(root/'docs/phase5/DT_Exchange_Phase5_Admin_Preview.html',out/'DT_Exchange_Phase5_Admin_Preview.html')
for source,name in [('01_processing.png','Payout_Processing'),('02_completed.png','Transaction_Completed'),('03_details.png','Transaction_Details'),('04_history.png','History')]:shutil.copyfile(root/'docs/phase5/previews'/source,out/f'DT_Exchange_Phase5_{name}.png')
print(json.dumps({'archive':str(archive),'files':len(files),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()},indent=2))
