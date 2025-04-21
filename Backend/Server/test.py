import asyncio
import websockets
import os
import base64
import ssl

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

uploads = {}

async def handler(websocket):
    async for message in websocket:
        try:
            # Format: filename:::chunk_number:::is_last:::base64_chunk
            filename, chunk_number, is_last, b64data = message.split(":::", 3)
            file_path = os.path.join(UPLOAD_DIR, filename)

            # decode and write in append mode
            file_bytes = base64.b64decode(b64data)
            with open(file_path, "ab") as f:
                f.write(file_bytes)

            if is_last == "1":
                await websocket.send(f"File '{filename}' uploaded successfully.")
        except Exception as e:
            await websocket.send(f"Error: {str(e)}")

async def main():
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain(
        certfile="/etc/letsencrypt/live/linkanaccount.com/fullchain.pem",
        keyfile="/etc/letsencrypt/live/linkanaccount.com/privkey.pem"
    )

    async with websockets.serve(
        handler, 
        "0.0.0.0", 
        443, 
        ssl=ssl_context
    ):
        print("Secure WebSocket server started at wss://linkanaccount.com")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
