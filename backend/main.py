from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pyautogui



app = FastAPI()


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


@app.post("/control")
def control(action: Action):
    if action.type == "mouse_move" and action.x is not None and action.y is not None:
        pyautogui.moveTo(action.x, action.y)
        return {"status": "moved", "x": action.x, "y": action.y}
    elif action.type == "mouse_click":
        pyautogui.click()
        return {"status": "clicked"}
    return {"status": "unknown action"}
