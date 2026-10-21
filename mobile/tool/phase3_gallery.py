"""Arrange genuine Flutter captures into a labelled review board; no UI pixels invented."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[2]
folder=root/'docs/phase3/previews'
items=[('login','Login'),('home','Home'),('profile','Profile'),('banks','Bank accounts'),('sell_confirm','Server quote'),('settings_devices','Device sessions')]
font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=ImageFont.truetype(font_path,24);small=ImageFont.truetype(font_path,16)
canvas=Image.new('RGB',(1280,2050),'#FFFFFF');d=ImageDraw.Draw(canvas)
d.text((40,28),'DT Exchange · Phase 3',font=ImageFont.truetype(font_path,38),fill='#081B3A')
d.text((40,85),'Flutter UI captures · sandbox API fixtures · transfers disabled',font=small,fill='#526582')
for i,(name,label) in enumerate(items):
 x=40+(i%3)*414;y=145+(i//3)*930
 d.text((x,y),label,font=font,fill='#081B3A')
 image=Image.open(folder/(name+'.png')).convert('RGB');image.thumbnail((386,844))
 canvas.paste(image,(x,y+43))
d.text((40,2020),'Approved palette and DT mark retained. No production verification or payment is represented.',font=small,fill='#526582')
canvas.save(root.parent/'DT_Exchange_Phase3_UI_Preview.png')
(folder/'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DT Exchange Phase 3 UI captures</title><style>body{background:#F7F9FC;color:#081B3A;font:16px system-ui;margin:32px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}img{width:100%;max-width:390px;border-radius:24px}article{background:white;padding:20px;border-radius:24px}</style><h1>DT Exchange · Phase 3</h1><p>Real Flutter captures using sandbox API fixtures. Transfers are disabled.</p><main>'+''.join(f'<article><h2>{label}</h2><img src="{name}.png" alt="DT Exchange {label}"></article>' for name,label in items)+'</main></html>')
print('Created Phase 3 review board and screenshot gallery.')
