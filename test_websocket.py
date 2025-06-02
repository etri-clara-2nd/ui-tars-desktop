import asyncio
import websockets
import json

async def test_websocket():
    uri = "ws://129.254.196.201:8002/ws/robot-stream"
    print(f"Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected successfully!")
            
            # 메시지 수신 대기
            while True:
                try:
                    message = await websocket.recv()
                    print(f"Received message of size: {len(message)} bytes")
                except websockets.exceptions.ConnectionClosed:
                    print("Connection closed")
                    break
                except Exception as e:
                    print(f"Error receiving message: {e}")
                    break
                    
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_websocket()) 