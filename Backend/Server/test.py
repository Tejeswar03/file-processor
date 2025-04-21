import asyncio
import websockets
import os
import base64

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# store progress of each upload
uploads = {}

async def handler(websocket):
    async for message in websocket:
        try:
            # Format: filename:::chunk_number:::is_last:::base64_chunk
            filename, chunk_number, is_last, b64data = message.split(":::", 3)
            file_path = os.path.join(UPLOAD_DIR, filename)

            # decode and write append mode
            file_bytes = base64.b64decode(b64data)
            with open(file_path, "ab") as f:
                f.write(file_bytes)

            if is_last == "1":
                await websocket.send(f"File '{filename}' uploaded successfully.")
        except Exception as e:
            await websocket.send(f"Error: {str(e)}")

async def main():
    async with websockets.serve(handler, "localhost", 6789):
        print("Server started at ws://localhost:6789")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())