import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

MOCK_TRANSCRIPT = [
    {"speaker": "doctor", "text": "Good morning, what brings you in today?"},
    {"speaker": "patient", "text": "I have been having fever and body ache since 2 days."},
    {"speaker": "doctor", "text": "Any cough or cold? Did you take any medicine?"},
    {"speaker": "patient", "text": "Slight cold hai, paracetamol liya kal."},
    {"speaker": "doctor", "text": "Temperature check karte hain. Throat bhi dekh lete hain."},
    {"speaker": "patient", "text": "Theek hai doctor sahab."},
    {"speaker": "doctor", "text": "BP normal hai. Throat thoda red hai. Viral infection lagta hai."},
    {"speaker": "patient", "text": "Koi serious baat toh nahi hai na?"},
    {"speaker": "doctor", "text": "Nahi, viral fever hai. 5 din ki medicine likhta hoon. Rest karo."},
]


@router.websocket("/session/{session_id}")
async def audio_stream(websocket: WebSocket, session_id: str):
    await websocket.accept()
    try:
        chunk_index = 0
        while True:
            data = await websocket.receive_bytes()
            # POC STUB: ignore actual audio, return next mock transcript line
            if chunk_index < len(MOCK_TRANSCRIPT):
                await websocket.send_json(
                    {
                        "type": "transcript_chunk",
                        "session_id": session_id,
                        **MOCK_TRANSCRIPT[chunk_index],
                    }
                )
                chunk_index += 1
            else:
                await websocket.send_json(
                    {
                        "type": "session_complete",
                        "session_id": session_id,
                    }
                )
    except WebSocketDisconnect:
        pass
