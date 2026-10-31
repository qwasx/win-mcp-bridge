"""Create a code-only source archive, leaving all supplied art in its original releases."""
from pathlib import Path
import json
import zipfile

root=Path(__file__).resolve().parent.parent
out=root/'.downloads/release';out.mkdir(parents=True,exist_ok=True)
allowed={'.ts','.tsx','.css','.json','.md','.py','.mjs','.html','.txt','.gitignore'}
files=[]
for folder in ['src','tools','docs']:
    for f in (root/folder).rglob('*'):
        if f.is_file() and f.suffix in allowed:files.append(f)
for name in ['package.json','package-lock.json','vite.config.ts','tsconfig.json','index.html','README.md','.gitignore']:
    files.append(root/name)
archive=out/'fanren-v047-shanhe-source-code-only.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=8) as z:
    for f in sorted(set(files)):z.write(f,Path('fanren')/f.relative_to(root))
print(f'Created {archive.relative_to(root)} ({archive.stat().st_size:,} bytes, {len(set(files))} code/documentation files).')
(out/'files.json').write_text(json.dumps([f.relative_to(root).as_posix() for f in sorted(set(files))],indent=2)+'\n')