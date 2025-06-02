#!/usr/bin/env python3
# 필요한 라이브러리 임포트
from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import List, Optional, Union, Dict, Any, Literal
from enum import Enum
import uvicorn
import json
import base64
from PIL import Image
import io
import os
import imghdr
import logging
import re
import time
import shutil
from pathlib import Path
import asyncio

# 로깅 설정 - INFO 레벨로 로깅 활성화
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI 애플리케이션 인스턴스 생성
app = FastAPI()

# CORS 미들웨어 설정 - 모든 도메인에서의 접근 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 로봇 동작 타입을 정의하는 열거형 클래스
class ActionType(str, Enum):
    PICK_AND_PLACE = "pick_and_place"  # 물체를 집어서 특정 위치에 놓기
    PICK = "pick"                      # 물체 집기
    PLACE = "place"                    # 물체 놓기
    MOVE = "move"                      # 특정 위치로 이동
    HOME = "home"                      # 홈 위치로 이동

# 3D 공간에서의 위치를 나타내는 클래스
class Position(BaseModel):
    x: float  # X 좌표
    y: float  # Y 좌표
    z: float  # Z 좌표

# 위치 정보를 나타내는 클래스
class Location(BaseModel):
    name: str                          # 위치 이름 (예: "테이블", "책상")
    position: Optional[Position] = None # 실제 3D 좌표
    description: Optional[str] = None  # 위치에 대한 추가 설명

# 물체 정보를 나타내는 클래스
class ObjectInfo(BaseModel):
    name: str                          # 물체 이름 (예: "사과", "컵")
    position: Optional[Position] = None # 물체의 현재 3D 위치
    description: Optional[str] = None  # 물체에 대한 추가 설명

# 로봇 동작 명령을 나타내는 클래스
class RobotAction(BaseModel):
    action_type: ActionType            # 수행할 동작 타입
    target_object: Optional[ObjectInfo] = None  # 대상 물체
    target_location: Optional[Location] = None  # 목표 위치
    target_position: Optional[Position] = None  # 목표 3D 좌표
    additional_params: Optional[Dict[str, Any]] = None  # 추가 매개변수

# 동작 실행 결과를 나타내는 클래스
class ActionResult(BaseModel):
    success: bool                      # 동작 성공 여부
    message: str                       # 결과 메시지
    details: Optional[Dict[str, Any]] = None  # 추가 세부 정보

# 채팅 메시지를 나타내는 클래스
class ChatMessage(BaseModel):
    role: str        # 메시지 작성자 역할 (system, user, assistant)
    content: str     # 메시지 내용

# 채팅 완성 요청을 나타내는 클래스
class ChatCompletionRequest(BaseModel):
    model: str       # 사용할 모델 이름
    messages: List[ChatMessage]  # 채팅 메시지 목록
    temperature: Optional[float] = 0.7  # 생성 다양성 조절
    max_tokens: Optional[int] = None    # 최대 토큰 수
    stream: Optional[bool] = False      # 스트리밍 여부

# 로봇의 현재 상태를 관리하는 클래스
class RobotState:
    def __init__(self):
        self.current_position = Position(x=0.0, y=0.0, z=0.0)  # 현재 위치
        self.is_holding_object = False  # 물체 파지 상태
        self.current_object = None      # 현재 들고 있는 물체
        self.is_busy = False           # 작업 수행 중 여부

# 로봇 상태 인스턴스 생성
robot_state = RobotState()

# WebSocket 연결을 관리하는 클래스
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []  # 활성 연결 목록

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast_screenshot(self, screenshot_data: bytes):
        # 모든 연결된 클라이언트에게 스크린샷 데이터 전송
        for connection in self.active_connections:
            try:
                await connection.send_bytes(screenshot_data)
            except:
                await self.disconnect(connection)

# 연결 관리자 인스턴스 생성
manager = ConnectionManager()

# WebSocket 엔드포인트 - 실시간 로봇 상태 스트리밍
@app.websocket("/ws/robot-stream")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # 연결 직후 현재 스크린샷 전송
        current_dir = Path(__file__).parent
        screenshot_path = current_dir / "robot_screenshot.png"
        
        if screenshot_path.exists():
            logger.info("WebSocket 연결 후 초기 스크린샷 전송")
            with open(screenshot_path, "rb") as f:
                screenshot_data = f.read()
                await websocket.send_bytes(screenshot_data)
        
        while True:
            # 클라이언트 연결이 유지되는 동안 대기
            await websocket.receive_text()
    except Exception as e:
        logger.error(f"WebSocket 에러: {str(e)}")
    finally:
        manager.disconnect(websocket)

# CURL 테스트 명령어:
# curl -X POST http://129.254.196.201:8001/v1/robot/action \
#   -H "Content-Type: application/json" \
#   -d '{
#     "action_type": "pick_and_place",
#     "target_object": {
#       "name": "사과"
#     },
#     "target_location": {
#       "name": "테이블"
#     }
#   }'

# 로봇 동작을 실행하는 비동기 함수
async def execute_robot_action(action: RobotAction) -> ActionResult:
    """로봇 액션을 실행하는 함수"""
    try:
        logger.info(f"Executing action: {action.action_type}")
        
        # 로봇이 이미 작업 중인지 확인
        if robot_state.is_busy:
            return ActionResult(
                success=False,
                message="Robot is busy executing another action"
            )

        robot_state.is_busy = True
        
        try:
            # PICK_AND_PLACE 동작 처리
            if action.action_type == ActionType.PICK_AND_PLACE:
                if not action.target_object or not action.target_location:
                    raise ValueError("Both target object and location are required for PICK_AND_PLACE action")
                
                # 로봇 동작 시뮬레이션 및 스크린샷 전송
                current_dir = Path(__file__).parent
                
                # 각 단계별 이미지 전송 (총 4단계)
                for step in range(1, 5):
                    # 실제 로봇 제어 코드는 여기에 구현
                    await asyncio.sleep(5)  # 5초 간격으로 이미지 전송
                    
                    # 현재 단계의 스크린샷 파일 경로
                    screenshot_path = current_dir / f"robot_action_{step}.png"
                    
                    if screenshot_path.exists():
                        logger.info(f"Sending screenshot: {screenshot_path}")
                        with open(screenshot_path, "rb") as f:
                            screenshot_data = f.read()
                            await manager.broadcast_screenshot(screenshot_data)
                    else:
                        logger.warning(f"Screenshot not found: {screenshot_path}")
                
                return ActionResult(
                    success=True,
                    message=f"Successfully moved {action.target_object.name} to {action.target_location.name}"
                )

            # PICK 동작 처리
            elif action.action_type == ActionType.PICK:
                if not action.target_object:
                    raise ValueError("Target object is required for PICK action")
                robot_state.is_holding_object = True
                robot_state.current_object = action.target_object
                return ActionResult(
                    success=True,
                    message=f"Successfully picked up {action.target_object.name}",
                    details={"object_name": action.target_object.name}
                )

            # PLACE 동작 처리
            elif action.action_type == ActionType.PLACE:
                if not robot_state.is_holding_object:
                    return ActionResult(
                        success=False,
                        message="No object is currently held"
                    )
                if not action.target_location:
                    raise ValueError("Target location is required for PLACE action")
                robot_state.is_holding_object = False
                placed_object = robot_state.current_object
                robot_state.current_object = None
                return ActionResult(
                    success=True,
                    message=f"Successfully placed {placed_object.name} on {action.target_location.name}",
                    details={
                        "object_name": placed_object.name,
                        "location": action.target_location.name
                    }
                )

            # HOME 동작 처리
            elif action.action_type == ActionType.HOME:
                robot_state.current_position = Position(x=0.0, y=0.0, z=0.0)
                return ActionResult(
                    success=True,
                    message="Successfully returned to home position"
                )

            else:
                return ActionResult(
                    success=False,
                    message=f"Unsupported action type: {action.action_type}"
                )

        finally:
            robot_state.is_busy = False

    except Exception as e:
        logger.error(f"Error executing action: {str(e)}")
        return ActionResult(
            success=False,
            message=f"Error executing action: {str(e)}"
        )

# CURL 테스트 명령어:
# curl -X POST http://129.254.196.201:8001/v1/robot/action \
#   -H "Content-Type: application/json" \
#   -d '{
#     "action_type": "pick_and_place",
#     "target_object": {
#       "name": "사과"
#     },
#     "target_location": {
#       "name": "테이블"
#     }
#   }'
@app.post("/v1/robot/action")
async def robot_action(action: RobotAction):
    """로봇 액션을 처리하는 엔드포인트"""
    try:
        result = await execute_robot_action(action)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# CURL 테스트 명령어:
# curl -X GET http://129.254.196.201:8001/v1/robot/status
@app.get("/v1/robot/status")
async def get_robot_status():
    """로봇의 현재 상태를 반환하는 엔드포인트"""
    return {
        "current_position": robot_state.current_position,
        "is_holding_object": robot_state.is_holding_object,
        "current_object": robot_state.current_object,
        "is_busy": robot_state.is_busy
    }

# CURL 테스트 명령어:
# curl -X GET http://129.254.196.201:8001/v1/models
@app.get("/v1/models")
async def list_models():
    return {
        "data": [
            {
                "id": "robot-api",
                "object": "model",
                "owned_by": "lmms-lab",
                "permission": []
            }
        ]
    }

# CURL 테스트 명령어:
# curl -X POST http://129.254.196.201:8001/v1/chat/completions \
#   -H "Content-Type: application/json" \
#   -d '{
#     "model": "robot-api",
#     "messages": [
#       {
#         "role": "user",
#         "content": "사과를 테이블 위로 옮겨줘"
#       }
#     ]
#   }'
@app.post("/v1/chat/completions")
async def create_chat_completion(request: ChatCompletionRequest):
    try:
        # 사용자 메시지에서 로봇 명령어 파싱
        last_message = request.messages[-1].content
        logger.info(f"Received message: {last_message}")
        
        # 기본 응답 설정
        response_content = None
        show_screenshot = False
        screenshot_url = None
        
        # 위치 관련 질문 패턴
        location_patterns = [
            "어디야", "어디에 있어", "어디 있어", "위치가 어디야",
            "지금 어디야", "지금 어디에 있어", "현재 위치"
        ]
        
        # 명령어 처리
        if any(pattern in last_message for pattern in location_patterns):
            logger.info("위치 확인 요청 감지됨")
            response_content = "제가 지금 있는 위치를 보여드리겠습니다."
            show_screenshot = True
            screenshot_url = "ws://129.254.196.201:8002/ws/robot-stream"
            
            try:
                # 현재 스크린샷 전송
                current_dir = Path(__file__).parent
                screenshot_path = current_dir / "robot_screenshot.png"
                logger.info(f"스크린샷 경로: {screenshot_path}")
                
                if screenshot_path.exists():
                    logger.info("스크린샷 파일 존재함, 전송 시도")
                    with open(screenshot_path, "rb") as f:
                        screenshot_data = f.read()
                        await manager.broadcast_screenshot(screenshot_data)
                        logger.info("스크린샷 전송 완료")
                else:
                    logger.warning("스크린샷 파일이 존재하지 않음")
            except Exception as e:
                logger.error(f"스크린샷 처리 중 에러 발생: {str(e)}")
        elif "너는 누구니" in last_message or "누구니" in last_message:
            response_content = "안녕하세요! 저는 CLARA입니다. 컴퓨터를 제어하고 로봇을 조작하는 것을 도와드릴 수 있습니다."
        elif "안녕" in last_message.lower() or "hello" in last_message.lower():
            response_content = "안녕하세요! 무엇을 도와드릴까요?"
        elif "도움말" in last_message or "help" in last_message.lower():
            response_content = """다음과 같은 명령을 사용할 수 있습니다.

1. 물체 이동
   • "[물체]를 [위치]로 옮겨줘"
   • 예시: "사과를 테이블 위로 옮겨줘"

2. 위치 확인
   • "어디야?"
   • "어디에 있어?"

3. 기본 동작
   • "홈 위치로 이동"

도움이 필요하시면 "도움말" 또는 "help"를 입력해주세요."""
        else:
            # 로봇 명령어 파싱 시도
            move_pattern = re.compile(r'([가-힣a-zA-Z]+)(?:을|를)\s*([가-힣a-zA-Z]+)(?:위로|위에|으로|로|에)\s*(?:옮겨줘|옮겨|놓아줘|놓아)')
            match = move_pattern.search(last_message)
            
            if match:
                object_name = match.group(1)
                location_name = match.group(2)
                
                action = RobotAction(
                    action_type=ActionType.PICK_AND_PLACE,
                    target_object=ObjectInfo(name=object_name),
                    target_location=Location(name=location_name)
                )
                logger.info(f"Parsed command: Move {object_name} to {location_name}")
                result = await execute_robot_action(action)
                response_content = result.message
            else:
                response_content = "명령을 이해하지 못했습니다. '사과를 테이블 위로 옮겨줘'와 같은 형식으로 말씀해 주세요. 도움말을 보시려면 'help'를 입력해주세요."

        response = {
            "id": f"chatcmpl-{hash(last_message) % 1000}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": request.model,
            "usage": {
                "prompt_tokens": len(last_message.split()),
                "completion_tokens": len(response_content.split()),
                "total_tokens": len(last_message.split()) + len(response_content.split())
            },
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": response_content,
                        "show_screenshot": show_screenshot,
                        "screenshot_url": screenshot_url
                    },
                    "finish_reason": "stop",
                    "index": 0
                }
            ]
        }
        return response
    except Exception as e:
        logger.error(f"Error processing chat completion: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002) 
