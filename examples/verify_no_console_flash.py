"""
Prove that no console window appears while the bridge executes commands.

Eyeballing is useless here: the flash lasts ~50 ms. This polls the window list
at 50 ms while hammering the API concurrently, then reports whether any console
window class was ever observed.

Usage:
    python verify_no_console_flash.py <hostname> <desktop_token>
"""
import asyncio
import sys

import httpx2
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

WATCHER = r"""
Add-Type @"
using System;using System.Runtime.InteropServices;using System.Text;
public class W{
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern int GetClassNameW(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] public static extern bool EnumWindows(P f,IntPtr l);
 public delegate bool P(IntPtr h,IntPtr l);
 public static int C(){int n=0;EnumWindows((h,l)=>{
   if(IsWindowVisible(h)){var c=new StringBuilder(64);GetClassNameW(h,c,64);
     var s=c.ToString();
     if(s=="ConsoleWindowClass"||s=="CASCADIA_HOSTING_WINDOW_CLASS")n++;}
   return true;},IntPtr.Zero);return n;}}
"@
$max=0
$end=(Get-Date).AddSeconds(12)
while((Get-Date) -lt $end){
  $c=[W]::C(); if($c -gt $max){$max=$c}
  Start-Sleep -Milliseconds 50
}
if($max -eq 0){"NO_CONSOLE_WINDOW_EVER_APPEARED"}else{"SAW_${max}_CONSOLE_WINDOWS"}
"""


async def main(host, token):
    url = f"https://{host}/desktop/mcp"
    hc = httpx2.AsyncClient(
        headers={"Authorization": f"Bearer {token}"},
        timeout=httpx2.Timeout(connect=30, read=180, write=60, pool=30),
        transport=httpx2.AsyncHTTPTransport(retries=3),
    )
    async with hc:
        async with streamable_http_client(url, http_client=hc) as (r, w, *_):
            async with ClientSession(r, w) as s:
                await s.initialize()

                watch = asyncio.create_task(
                    s.call_tool("RunScript",
                                {"language": "ps", "code": WATCHER, "timeout": 120})
                )
                await asyncio.sleep(1)

                noise = []
                for _ in range(4):
                    noise.append(s.call_tool(
                        "RunScript", {"language": "ps", "code": "Get-Date", "timeout": 60}))
                    noise.append(s.call_tool(
                        "RunScript", {"language": "cmd", "code": "echo hi", "timeout": 60}))
                    noise.append(s.call_tool(
                        "RunScript", {"language": "python", "code": "print(1)", "timeout": 60}))
                await asyncio.gather(*noise, return_exceptions=True)

                res = await watch
                print("".join(getattr(c, "text", "") for c in res.content).strip())


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    asyncio.run(main(sys.argv[1], sys.argv[2]))
