"""Package the authorized Phase 2 source and preview deliverables, excluding local build state."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib,json,shutil

root=Path(__file__).resolve().parents[1]
out=root.parent
exclude_dirs={'node_modules','.next','dist','build','.dart_tool','.git','.gradle','.idea','Pods','.symlinks','ephemeral','__pycache__','.tooling','.swiftpm'}
exclude_names={'.DS_Store','.flutter-plugins','.flutter-plugins-dependencies','local.properties','Generated.xcconfig','flutter_export_environment.sh','GeneratedPluginRegistrant.h','GeneratedPluginRegistrant.m','GeneratedPluginRegistrant.java','SourceManifest.json','SOURCE_MANIFEST.json'}
allowed=[]
for p in sorted(root.rglob('*')):
 if not p.is_file() or p.is_symlink():continue
 rel=p.relative_to(root)
 if any(part in exclude_dirs for part in rel.parts):continue
 if p.name in exclude_names or p.suffix in {'.iml','.pyc','.tsbuildinfo'}:continue
 if p.name.startswith('.env') and p.name!='.env.example':continue
 if p.name.endswith('.log') and not str(rel).startswith('docs/phase2/validation/'):continue
 if rel.as_posix().startswith('docs/phase2/validation/') and p.name not in {'flutter-analyze.log','flutter-tests.log','flutter-web-build.log','android-build-attempt.log','flutter-version.log','design-tokens.log','phase1-preservation.json'}:continue
 allowed.append(p)
manifest={'product':'DT Exchange','phase':2,'scope':'Complete mobile UI and isolated preview; Phase 3 not started','files':[{'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in allowed]}
manifest_path=root/'SOURCE_MANIFEST.json';manifest_path.write_text(json.dumps(manifest,indent=2)+'\n');allowed.append(manifest_path)
source=out/'DT_Exchange_Phase2_Source.zip'
with ZipFile(source,'w',ZIP_DEFLATED,compresslevel=9)as z:
 for p in allowed:z.write(p,Path('dt-exchange')/p.relative_to(root))
with ZipFile(source)as z:assert z.testzip() is None
preview=out/'DT_Exchange_Phase2_UI_Previews.zip'
with ZipFile(preview,'w',ZIP_DEFLATED,compresslevel=9)as z:
 for p in sorted((root/'docs/phase2/previews').glob('*')):z.write(p,Path('DT_Exchange_UI_Previews')/p.name)
 for p in sorted((root/'docs/phase2/boards').glob('*.png')):z.write(p,Path('DT_Exchange_UI_Previews/boards')/p.name)
with ZipFile(preview)as z:assert z.testzip() is None
copies={'docs/phase2/IMPLEMENTATION.md':'DT_Exchange_Phase2_Implementation.md','docs/phase2/TEST_RESULTS.md':'DT_Exchange_Phase2_Test_Results.md','docs/phase2/boards/01_Everyday.png':'DT_Exchange_Phase2_UI_Preview.png','docs/phase2/boards/02_Exchange.png':'DT_Exchange_Phase2_Exchange_Preview.png','docs/phase2/boards/03_Account.png':'DT_Exchange_Phase2_Account_Preview.png'}
for src,dst in copies.items():shutil.copyfile(root/src,out/dst)
for p in [source,preview,*[out/d for d in copies.values()]]:print(p.name,p.stat().st_size,hashlib.sha256(p.read_bytes()).hexdigest())
print('Source archive files:',len(allowed))
