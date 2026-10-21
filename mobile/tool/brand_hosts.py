"""Rasterize the final approved DT logo into native/web launcher sizes.
Requires CairoSVG and Pillow; run from repository root.
"""
import io
import json
import cairosvg
from pathlib import Path
from PIL import Image
root=Path('mobile')
def icon(p,size):
    data=cairosvg.svg2png(url='brand/dt-monogram.svg',output_width=int(size*.78),output_height=int(size*.78))
    content=Image.open(io.BytesIO(data)).convert('RGBA')
    base=Image.new('RGB',(size,size),'white');base.paste(content,((size-content.width)//2,(size-content.height)//2),content);base.save(p)
for name,size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    icon(root/f'android/app/src/main/res/mipmap-{name}/ic_launcher.png',size)
for p in (root/'ios/Runner/Assets.xcassets/AppIcon.appiconset').glob('*.png'):icon(p,Image.open(p).width)
for p in (root/'web/icons').glob('*.png'):icon(p,Image.open(p).width)
icon(root/'web/favicon.png',32)
p=root/'web/manifest.json';d=json.loads(p.read_text());d.update(name='DT Exchange',short_name='DT Exchange',description='Sell USDT. Receive INR. Application foundation. Transfers not enabled.',background_color='#FFFFFF',theme_color='#FFFFFF',orientation='any');p.write_text(json.dumps(d,indent=2)+'\n')
p=root/'web/index.html';s=p.read_text().replace('A new Flutter project.','Sell USDT. Receive INR. Application foundation. Transfers not enabled.').replace('content="dt_exchange"','content="DT Exchange"').replace('<title>dt_exchange</title>','<title>DT Exchange</title>').replace('content="black"','content="default"');p.write_text(s)
p=root/'ios/Runner/Info.plist';s=p.read_text().replace('<string>Dt Exchange</string>','<string>DT Exchange</string>').replace('<string>dt_exchange</string>','<string>DT Exchange</string>');p.write_text(s)
p=root/'android/app/src/main/AndroidManifest.xml';s=p.read_text().replace('android:label="dt_exchange"','android:label="DT Exchange"\n        android:allowBackup="false"');p.write_text(s)
p=root/'android/app/src/main/res/values-night/styles.xml';p.write_text((root/'android/app/src/main/res/values/styles.xml').read_text())
for p in (root/'android/app/src/main/res').glob('drawable*/launch_background.xml'):
    p.write_text(p.read_text().replace('?android:colorBackground','@android:color/white'))
print('Native/web icons generated from the approved DT monogram.')
