"""Render the supplied narration with original illustrative product motion graphics."""
from pathlib import Path
import sys, wave, math, subprocess, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'promo-tools'))
import imageio_ffmpeg
OUT = ROOT / 'tapsynk-promo'
OUT.mkdir(exist_ok=True)
W, H, FPS = 720, 1280, 24
BLUE, WHITE, MUTED, GREEN = '#3976ff', '#ffffff', '#aabbd9', '#62e8ba'
def font(size, bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/' + ('segoeuib.ttf' if bold else 'segoeui.ttf'), size)
fonts = {(s,b):font(s,b) for s in [18,22,24,28,32,38,44,52,62,72] for b in [False,True]}
def txt(d, xy, text, size=28, color=WHITE, bold=False, center=False):
    f=fonts[size,bold]
    if center: xy=(xy[0]-d.textlength(text,font=f)/2,xy[1])
    d.text(xy,text,font=f,fill=color)
def rr(d, box, fill, r=24, outline=None, width=2):
    d.rounded_rectangle(tuple(int(v) for v in box),radius=r,fill=fill,outline=outline,width=width)
def pill(d, x,y,text,fill=BLUE,color=WHITE):
    width=d.textlength(text,font=fonts[22,True])+40
    rr(d,(x,y,x+width,y+44),fill,22)
    txt(d,(x+20,y+7),text,22,color,True)
def card(d,x,y,scale=1):
    def p(a,b):return (x+a*scale,y+b*scale)
    rr(d,(*p(0,0),*p(490,294)),'#132748',26, '#507fc4',2)
    txt(d,p(32,27),'TapSynk',38,WHITE,True)
    txt(d,p(32,172),'Your next connection.',28,WHITE,True)
    txt(d,p(32,217),'Tap to connect  +  QR backup',22,MUTED)
    txt(d,p(400,42),'TK',28,GREEN,True)
def phone(d,x,y,mode,p):
    rr(d,(x,y,x+310,y+530),'#050b16',42,'#546b94',3)
    rr(d,(x+12,y+12,x+298,y+518),'#f5f8ff',32)
    rr(d,(x+104,y+16,x+206,y+36),'#050b16',12)
    if mode=='profile':
        rr(d,(x+23,y+53,x+287,y+146),BLUE,16)
        d.ellipse((x+108,y+111,x+202,y+205),fill='#122d61',outline=WHITE,width=4)
        txt(d,(x+155,y+128),'TS',38,WHITE,True,True)
        txt(d,(x+155,y+218),'Your business',28,'#142745',True,True)
        txt(d,(x+155,y+261),'Your details. Your links.',18,'#5c6d88',False,True)
        rr(d,(x+35,y+317,x+275,y+372),BLUE,16)
        txt(d,(x+155,y+329),'Save contact',24,WHITE,True,True)
        rr(d,(x+35,y+387,x+275,y+442),'#e3ebfd',16)
        txt(d,(x+155,y+400),'Share my contact',22,'#214680',True,True)
    elif mode=='chat':
        txt(d,(x+155,y+66),'Ask my AI',28,'#16284a',True,True)
        pill(d,x+78,y+115,'AI Card','#dbe8ff','#1d5bff')
        rr(d,(x+53,y+191,x+281,y+271),BLUE,18)
        txt(d,(x+68,y+207),'What services',22,WHITE)
        txt(d,(x+68,y+237),'do you offer?',22,WHITE)
        if p>.25:
            rr(d,(x+29,y+300,x+257,y+417),'#e0e9fa',18)
            txt(d,(x+44,y+318),'Let me help with',22,'#22385c')
            txt(d,(x+44,y+351),'your questions.',22,'#22385c')
            txt(d,(x+44,y+385),'Voice or chat',18,'#52688e')
    else:
        txt(d,(x+155,y+66),'Book a meeting',28,'#16284a',True,True)
        txt(d,(x+155,y+125),'Available appointments',18,'#52688e',False,True)
        for i,label in enumerate(['10:00 AM','11:30 AM','02:00 PM']):
            rr(d,(x+35,y+180+i*72,x+275,y+238+i*72),BLUE if i==1 else '#e0e9fa',16)
            txt(d,(x+155,y+193+i*72),label,24,WHITE if i==1 else '#22385c',True,True)
        if p>.45:
            rr(d,(x+28,y+431,x+282,y+480),'#c9f6e5',16)
            txt(d,(x+155,y+443),'Booking confirmed',22,'#146747',True,True)

scenes=[
    (['You made the','connection.'], 'Keep the conversation going.', 'INTRO'),
    (['One tap.','Stay connected.'], 'No app needed on compatible phones.', 'TAP + SHARE'),
    (['Your business.','Ready to answer.'], 'An AI assistant on your AI Card.', 'AI CARD'),
    (['Give interest','a next step.'], 'Book available appointments.', 'APPOINTMENTS'),
    (['Know what','happens next.'], 'Shared contacts and activity in one place.', 'LEADS + ANALYTICS'),
    (['One card.','Always current.'], 'smart card included with your plan.', 'BUILT TO CONNECT'),
    (['See it work for','your business.'], 'Book a free 15-minute demo.', 'YOUR NEXT STEP'),
]
waves=[]; durations=[]; rate=None
for i in range(7):
    with wave.open(str(OUT/f'voice-{i}.wav'),'rb') as f:
        assert f.getsampwidth()==2
        rate=f.getframerate()
        a=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').reshape(-1,f.getnchannels()).mean(axis=1)
    silence=np.zeros(int(rate*.48))
    part=np.concatenate([a,silence]); waves.append(part); durations.append(len(part)/rate)
voice=np.concatenate(waves)
with wave.open(str(OUT/'voiceover.wav'),'wb') as f:
    f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(voice.astype('<i2').tobytes())
total=len(voice)/rate
# Quiet original instrumental pulse beneath speech; no external music assets.
t=np.arange(len(voice))/rate
bed=np.zeros(len(t))
for i,freq in enumerate([220,261.63,329.63,293.66]):
    gate=(np.floor(t/2)%4==i)
    bed+=gate*(np.sin(2*np.pi*freq*t)*220+np.sin(2*np.pi*freq*2*t)*70)
beat=(t%(.5))
bed+=650*np.exp(-beat*35)*np.sin(2*np.pi*(65*beat+3*(1-np.exp(-beat*25))))
fade=np.minimum(1,t/.8)*np.minimum(1,(total-t)/1.1)
mix=np.clip((voice*1.1+bed)*fade,-32760,32760).astype('<i2')
with wave.open(str(OUT/'mix.wav'),'wb') as f:
    f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(mix.tobytes())
yy,xx=np.mgrid[0:H,0:W]
glow=np.exp(-(((xx-590)/540)**2+((yy-520)/700)**2))
base=np.stack([9+glow*10,17+glow*26,34+glow*56],axis=-1).astype('uint8')
starts=np.concatenate([[0],np.cumsum(durations)])
def frame(t):
    idx=min(6,int(np.searchsorted(starts,t,side='right')-1))
    p=min(1,(t-starts[idx])/durations[idx]); ease=1-(1-min(p*4,1))**3
    im=Image.fromarray(base.copy());d=ImageDraw.Draw(im)
    for n in range(16):
        x=(n*93+t*10)%W;y=(n*167+t*17)%H
        d.ellipse((x,y,x+3,y+3),fill='#2c476d')
    txt(d,(46,44),'TapSynk',32,WHITE,True)
    txt(d,(674,53),'ONE TAP. MORE POSSIBILITIES.',18,MUTED,False,False) if False else None
    pill(d,46,118,scenes[idx][2], '#173967', '#a7c6ff')
    offset=int((1-ease)*32)
    for j,line in enumerate(scenes[idx][0]):txt(d,(46,196+j*80+offset),line,62,WHITE if j==0 else '#7da8ff',True)
    if idx==0:
        card(d,115,515+math.sin(t*1.4)*10)
        rr(d,(90,876,630,960),'#172f53',24)
        txt(d,(360,897),'An introduction is just the start.',28,WHITE,True,True)
    elif idx==1:
        phone(d,270,432,'profile',p)
        layer=Image.new('RGBA',(540,350));ld=ImageDraw.Draw(layer);card(ld,8,8)
        layer=layer.rotate(-12,resample=Image.Resampling.BICUBIC,expand=True)
        layer=layer.resize((int(layer.width*.75),int(layer.height*.75)),Image.Resampling.LANCZOS)
        im.paste(layer,(int(-125+100*ease),665),layer);d=ImageDraw.Draw(im)
    elif idx==2:phone(d,205,425,'chat',p)
    elif idx==3:phone(d,205,425,'booking',p)
    elif idx==4:
        rr(d,(46,455,674,945),'#122743',28,'#2b4a76')
        txt(d,(76,487),'Your activity dashboard',28,WHITE,True)
        for i,label in enumerate(['Contacts shared','Card activity','Appointments']):
            rr(d,(76,553+i*94,644,629+i*94),'#1b3659',18)
            d.ellipse((97,575+i*94,129,607+i*94),fill=BLUE)
            txt(d,(149,572+i*94),label,24,WHITE,True)
            txt(d,(610,577+i*94),'>',24,GREEN,True)
        txt(d,(76,869),'Follow up with a clear next step.',22,MUTED)
    elif idx==5:
        card(d,115,464+math.sin(t*1.4)*10)
        for i,label in enumerate(['Editable digital profile','Tap + QR backup','No reprinting your details']):
            txt(d,(112,821+i*57),'+',28,GREEN,True)
            txt(d,(153,821+i*57),label,28,WHITE)
    else:
        card(d,115,441)
        rr(d,(46,815,674,924),BLUE,28)
        txt(d,(360,837),'Book your free demo',38,WHITE,True,True)
        txt(d,(360,954),'15 minutes. Your business. Your questions.',24,MUTED,False,True)
    txt(d,(360,1062),scenes[idx][1],24,MUTED,False,True)
    txt(d,(46,1186),'Illustrative product demo',18,'#7b92b6')
    txt(d,(495,1186),'AI requires AI plan',18,'#7b92b6')
    rr(d,(46,1240,674,1246),'#253b5b',3)
    rr(d,(46,1240,46+628*t/total,1246),BLUE,3)
    # Brief fade between scenes for clean transitions.
    local=t-starts[idx];remaining=starts[idx+1]-t
    opacity=min(1,local/.18,remaining/.18)
    if opacity<1: im=Image.blend(Image.fromarray(base),im,max(0,opacity))
    return im

ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
video=OUT/'tapsynk-promo.mp4'
cmd=[ffmpeg,'-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(OUT/'mix.wav'),'-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart',str(video)]
with open(OUT/'render.log','w') as log:
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
    for i in range(math.ceil(total*FPS)):
        proc.stdin.write(frame(i/FPS).tobytes())
    proc.stdin.close();code=proc.wait()
    if code:raise RuntimeError('Encoding failed; see render.log')
sheet=Image.new('RGB',(360*4,640*2),'#091122')
for idx in range(7):
    image=frame(float(starts[idx]+durations[idx]*.6))
    image.save(OUT/f'scene-{idx+1}.png')
    sheet.paste(image.resize((360,640)),((idx%4)*360,(idx//4)*640))
sheet.save(OUT/'contact-sheet.jpg')
frame(float(starts[6]+1)).save(OUT/'poster.png')
metadata={'duration_seconds':round(total,2),'width':W,'height':H,'fps':FPS,'voice':'Microsoft Zira Desktop, rate +2','scene_durations':durations,'source':'Illustrative motion graphics based on local website source','video':str(video)}
(OUT/'metadata.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
print(json.dumps(metadata,indent=2))
