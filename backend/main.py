from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from transformers import pipeline
from PIL import Image
import io
import base64
from pydantic import BaseModel
import pyautogui

app = FastAPI()
pipe = pipeline("image-classification", model="prithivMLmods/Hand-Gesture-19")

class Action(BaseModel):
    type: str
    x: int = None
    y: int = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev only!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def decode_base64_image(data_url):
    header, encoded = data_url.split(",", 1)
    img_bytes = base64.b64decode(encoded)
    return Image.open(io.BytesIO(img_bytes))

@app.post("/classify")
async def classify(request: Request):
    data = await request.json()
    image_data_url = data['image']
    image = decode_base64_image(image_data_url)
    result = pipe(image)
    return {"result": result}








@app.post("/control")
def control(action: Action):
    if action.type == "mouse_move" and action.x is not None and action.y is not None:
        pyautogui.moveTo(action.x, action.y)
        return {"status": "moved", "x": action.x, "y": action.y}
    elif action.type == "mouse_click":
        pyautogui.click()
        return {"status": "clicked"}
    return {"status": "unknown action"}