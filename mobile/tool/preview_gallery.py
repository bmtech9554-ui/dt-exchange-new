"""Assemble a static gallery from actual Flutter PNG captures. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import html

root=Path(__file__).resolve().parents[2]
images=root/'docs/phase2/previews'
boards=root/'docs/phase2/boards'
boards.mkdir(parents=True,exist_ok=True)
fonts=root/'mobile/test/assets'
def font(size,bold=False):return ImageFont.truetype(str(fonts/('Roboto-Medium.ttf' if bold else 'Roboto-Regular.ttf')),size)
navy='#081B3A';muted='#52647C';bg='#F7F9FC';mint='#EAFEF6';teal='#18C7BA'
titles={'01_splash':'Splash','02_login':'Login','03_register':'Register','04_otp':'OTP verification','05_home':'Home','06_wallet':'Wallet','07_deposit':'Deposit USDT','08_sell_amount':'Sell · Amount','09_sell_confirm':'Sell · Confirm','10_sell_send':'Sell · Send','11_sell_track':'Sell · Track','12_sell_success':'Transaction success','13_history':'History','14_transaction_details':'Transaction details','15_profile':'Profile','16_banks':'Bank accounts','17_add_bank':'Add bank account','18_referral':'Referral program','19_settings':'Settings','20_notifications':'Notifications','21_support':'Help & Support','22_support_ticket':'Support ticket','23_activation':'Account activation','24_password':'Change password','25_pin':'Security PIN','26_biometrics':'Biometric preference','27_2fa':'2FA preference','28_devices':'Login devices','29_preferences':'App preferences','30_alerts':'Notification preferences','31_user_details':'User details','32_privacy':'Privacy','33_terms':'Terms','34_delete':'Delete preview account','35_forgot_password':'Forgot password','36_reset_password':'Reset password'}
groups=[('01_Everyday','A simpler way forward.',['01_splash','02_login','03_register','04_otp','05_home','06_wallet','13_history','15_profile']),('02_Exchange','Your exchange, every step.',['07_deposit','08_sell_amount','09_sell_confirm','10_sell_send','11_sell_track','12_sell_success','14_transaction_details','16_banks']),('03_Account','Made for your everyday.',['17_add_bank','18_referral','19_settings','20_notifications','21_support','22_support_ticket','23_activation','29_preferences'])]
for filename,subtitle,keys in groups:
 canvas=Image.new('RGB',(1600,1860),bg);d=ImageDraw.Draw(canvas)
 d.rectangle((0,0,1600,200),fill='white')
 logo=Image.open(root/'mobile/web/icons/Icon-192.png').convert('RGB').resize((100,100),Image.Resampling.LANCZOS);canvas.paste(logo,(42,32))
 d.text((158,35),'DT Exchange',font=font(44,True),fill=navy)
 d.text((160,96),'Sell USDT. Receive INR.',font=font(23),fill=muted)
 d.rounded_rectangle((1260,48,1536,98),25,fill=mint);d.text((1290,61),'PHASE 2  /  FLUTTER',font=font(18,True),fill='#086750')
 d.text((64,151),subtitle,font=font(22),fill=navy)
 d.text((955,154),'Original design · Actual application renders',font=font(18),fill=muted)
 for i,key in enumerate(keys):
  col=i%4;row=i//4;x=64+col*376;y=240+row*780
  d.text((x,y),f'{i+1:02}  {titles[key]}',font=font(19,True),fill=navy)
  shot=Image.open(images/f'{key}.png').convert('RGB').resize((328,710),Image.Resampling.LANCZOS)
  d.rounded_rectangle((x-7,y+36,x+335,y+760),26,fill='white',outline='#E3EBF3',width=1)
  mask=Image.new('L',shot.size,0);ImageDraw.Draw(mask).rounded_rectangle((0,0,327,709),20,fill=255)
  canvas.paste(shot,(x,y+43),mask)
 d.text((64,1810),'Preview data only. No real accounts, deposits, trades or payouts.',font=font(18),fill=muted)
 d.text((1204,1810),'390 × 844 viewport',font=font(18),fill=muted)
 canvas.save(boards/f'{filename}.png',optimize=True)
items='\n'.join(f'<a class="card" href="{key}.png"><img src="{key}.png" alt="{html.escape(title)}" loading="lazy"><span>{html.escape(title)}</span></a>' for key,title in titles.items())
(images/'index.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DT Exchange · Phase 2 UI gallery</title><style>*{box-sizing:border-box}body{margin:0;background:#F7F9FC;color:#081B3A;font-family:system-ui,sans-serif}header,main,footer{max-width:1500px;margin:auto;padding:32px}header p,footer{color:#52647C}h1{margin:8px 0;font-size:36px}header small{color:#087E64;letter-spacing:2px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:26px}.card{display:block;overflow:hidden;border-radius:24px;background:white;padding:12px;text-decoration:none;color:inherit;box-shadow:0 8px 30px #081b3a08}.card img{width:100%;height:auto;border-radius:18px}.card span{display:block;padding:16px;font-weight:600}a:focus-visible{outline:3px solid #3D6FF5}</style><header><small>PHASE 2 · FLUTTER UI</small><h1>DT Exchange</h1><p>Sell USDT. Receive INR.</p><p>36 actual Flutter renders. Open a screen to view its full-resolution image. These are static previews using sample data.</p></header><main>'''+items+'''</main><footer>White · Mint · Teal · Soft Blue · Navy<br>All long pages scroll in the app. Screenshots show their initial viewport. No real transfers occur. Phase 3 has not started.</footer></html>''')
print(f'Created {len(groups)} preview boards and a {len(titles)}-screen static gallery.')
