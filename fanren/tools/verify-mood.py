from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw

root=Path('src/assets/mood')
manifest=json.loads((root/'manifest.json').read_text())
results=[]
tiles=[]
for name,meta in manifest.items():
    path=root/(name+'.png')
    im=Image.open(path);a=np.array(im)
    assert im.format=='PNG' and im.mode=='RGBA',name+' is not true RGBA PNG'
    assert im.size==(meta['width'],meta['height']),name+' has incorrect dimensions'
    assert im.info.get('srgb')==0,name+' is not explicitly sRGB'
    if name!='paper_grain': assert int(a[:,:,3].min())==0,name+' has no transparent pixels'
    seam_x=seam_y=None
    if meta['tile_x']:
        seam_x=int(np.max(np.abs(a[:,0].astype(int)-a[:,-1].astype(int))))
        assert seam_x<=1,name+' has a horizontal edge discontinuity'
        shifted=np.roll(a,im.width//2,axis=1)
        thumb=Image.fromarray(shifted);thumb.thumbnail((590,160));tiles.append((name,thumb))
    if meta['tile_y']:
        seam_y=int(np.max(np.abs(a[0].astype(int)-a[-1].astype(int))))
        assert seam_y<=1,name+' has a vertical edge discontinuity'
    if name=='ink_vignette':
        assert a[int(im.height*.15)+1:int(im.height*.85)-1,int(im.width*.15)+1:int(im.width*.85)-1,3].max()==0
    results.append({'asset':name,'rgba':True,'dimensions':im.size,'srgb':True,'x_seam_max':seam_x,'y_seam_max':seam_y})
out=Path('.downloads/verification');out.mkdir(parents=True,exist_ok=True)
(out/'assets.json').write_text(json.dumps(results,indent=2)+'\n')
sheet=Image.new('RGB',(1200,((len(tiles)+1)//2)*190),'#e9dfc6');d=ImageDraw.Draw(sheet)
for i,(name,im) in enumerate(tiles):
    x=(i%2)*600;y=(i//2)*190;sheet.paste(im,(x,y+23),im);d.text((x+6,y+3),name+' / 50% offset',fill='#344c43')
sheet.save(out/'offset-review.png')
print(f'PASS {len(results)} true RGBA PNGs, exact dimensions, sRGB, alpha and all tile boundaries. Offset sheet saved for visual review.')