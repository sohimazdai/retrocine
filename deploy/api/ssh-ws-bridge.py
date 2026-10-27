#!/usr/bin/env python3
# WebSocket (127.0.0.1:2222, за Caddy) <-> sshd 127.0.0.1:22. Нужен средам, откуда наружу открыт только HTTPS.
import asyncio, websockets
async def handler(ws, path=None):
    try:
        r, w = await asyncio.open_connection("127.0.0.1", 22)
    except Exception:
        await ws.close(); return
    async def up():
        try:
            async for m in ws:
                w.write(m if isinstance(m, bytes) else m.encode()); await w.drain()
        finally:
            w.close()
    async def down():
        try:
            while True:
                d = await r.read(65536)
                if not d: break
                await ws.send(d)
        finally:
            await ws.close()
    await asyncio.gather(up(), down(), return_exceptions=True)
async def main():
    async with websockets.serve(handler, "127.0.0.1", 2222, max_size=None, ping_interval=20, compression=None):
        await asyncio.Future()
asyncio.run(main())
