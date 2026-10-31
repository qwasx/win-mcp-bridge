"""Restore existing release art without committing or re-uploading its binaries."""
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request
import zipfile

root=Path(__file__).resolve().parent.parent
cache=root/'.downloads';cache.mkdir(exist_ok=True)
sources={
    'source.zip':'https://github.com/qwasx/win-mcp-bridge/releases/download/fanren-v0.46-zhongsheng/fanren-v046-zhongsheng-source.zip',
    'mood.zip':'https://github.com/qwasx/win-mcp-bridge/releases/download/mood-textures-23/mood_textures_all_23.zip',
}
for name,url in sources.items():
    file=cache/name
    if not file.exists():
        print('Downloading existing release:',name,flush=True)
        urllib.request.urlretrieve(url,file)

with zipfile.ZipFile(cache/'source.zip') as archive:
    for name in archive.namelist():
        if name.endswith('/'):continue
        if name.startswith('fanren/src/assets/'):
            rel=Path(name.removeprefix('fanren/src/assets/'))
            for target in [root/'src/assets'/rel,root/'public/game-assets'/rel]:
                target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.read(name))
        elif name.startswith('fanren/public/'):
            rel=Path(name.removeprefix('fanren/public/'))
            target=root/'public/art'/rel;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.read(name))

folder=root/'.mood';folder.mkdir(exist_ok=True)
with zipfile.ZipFile(cache/'mood.zip') as archive:archive.extractall(folder)
try:
    import numpy,scipy,PIL
except ImportError:
    print('Install texture-processing dependencies: python -m pip install pillow numpy scipy')
    sys.exit(1)
subprocess.run([sys.executable,str(root/'tools/prepare-mood.py')],cwd=root,check=True)
target=root/'public/mood';target.mkdir(parents=True,exist_ok=True)
for f in (root/'src/assets/mood').glob('*.png'):shutil.copy2(f,target/f.name)
poster=root/'public/art/mirror-lake.jpg'
if not poster.exists():
    # The code-only distribution reuses the original title art as its safe fallback.
    from PIL import Image
    Image.open(root/'public/art/title.webp').convert('RGB').save(poster,quality=94)
print('Restored original art and prepared all 23 mood overlays. Run npm install, then npm run dev.')