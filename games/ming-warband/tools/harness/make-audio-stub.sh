#!/bin/sh
# 为 node-web-audio-api 生成空壳 libasound（离线渲染不需要声卡）。用法：LD_LIBRARY_PATH=/tmp/t/stub
set -e
cd /tmp/t
npm i --no-audit --no-fund node-web-audio-api >/dev/null 2>&1
F=node_modules/node-web-audio-api/node-web-audio-api.linux-x64-gnu.node
mkdir -p stub
nm -D --undefined-only $F | grep snd_ | awk '{print $2}' > stub/syms_v.txt
python3 - <<'PY'
import collections
vers=collections.defaultdict(list)
for l in open('/tmp/t/stub/syms_v.txt'):
    l=l.strip(); s,v=(l.split('@',1)+['ALSA_0.9'])[:2]; vers[v.lstrip('@')].append(s)
order=sorted(vers)
src=['long %s(void){return -1;}'%s for v in vers for s in vers[v]]
open('/tmp/t/stub/asound.c','w').write('\n'.join(src)+'\n')
out=[];prev=None
for v in order:
    out.append(v+' { global: '+' '.join(s+';' for s in vers[v])+(' local: *;' if prev is None else '')+' }'+(' '+prev if prev else '')+';'); prev=v
open('/tmp/t/stub/asound.map','w').write('\n'.join(out)+'\n')
PY
gcc -shared -fPIC -o stub/libasound.so.2 stub/asound.c -Wl,-soname,libasound.so.2 -Wl,--version-script=stub/asound.map
echo ok
