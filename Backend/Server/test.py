import asyncio
import websockets
import os
import base64

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

async def handler(websocket):
    async for message in websocket:
        try:
            # Expecting: filename:::base64_encoded_file
            filename, b64data = message.split(":::", 1)
            file_bytes = base64.b64decode(b64data)
            file_path = os.path.join(UPLOAD_DIR, filename)

            with open(file_path, "wb") as f:
                f.write(file_bytes)

            await websocket.send(f"File '{filename}' uploaded successfully.")
        except Exception as e:
            await websocket.send(f"Error: {str(e)}")

async def main():
    async with websockets.serve(handler, "localhost", 6789):
        print("Server started at ws://localhost:6789")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())