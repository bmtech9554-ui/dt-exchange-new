"""Compose actual Flutter widget captures; never synthesize app screenshots."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[1]
base=root/'docs/phase5'
items=[('01_processing.png','Payout processing'),('02_completed.png','Transaction completed'),('03_details.png','Transaction details'),('04_history.png','History')]
width,gap,pad=330,28,48
images=[]
for name,label in items:
 im=Image.open(base/'previews'/name).convert('RGB')
 images.append((im.resize((width,round(im.height*width/im.width)),Image.Resampling.LANCZOS),label))
w=pad*2+width*4+gap*3;h=210+max(im.height for im,_ in images)+65
out=Image.new('RGB',(w,h),'#F7F9FC');draw=ImageDraw.Draw(out)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
large=ImageFont.truetype(font,34);small=ImageFont.truetype(font,18);bold=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',19)
logo=Image.open(root/'mobile/web/icons/Icon-192.png').convert('RGBA').resize((86,86));out.paste(logo,(pad,30),logo)
draw.text((pad+108,32),'DT Exchange · Phase 5',font=large,fill='#081B3A')
draw.text((pad+108,82),'Actual Flutter UI · sandbox provider fixtures · no real INR transfer',font=small,fill='#526784')
for n,(im,label) in enumerate(images):
 x=pad+n*(width+gap);draw.text((x,160),label,font=bold,fill='#081B3A');out.paste(im,(x,205))
draw.text((pad,h-38),'Approved logo, colors, components and four-tab navigation preserved.',font=small,fill='#526784')
out.save(base/'DT_Exchange_Phase5_UI_Preview.png')
