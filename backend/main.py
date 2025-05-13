from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pyautogui
from typing import Optional



app = FastAPI()


class Action(BaseModel):
    type: str
    x: Optional[int] = None
    y: Optional[int] = None
    key: Optional[str] = None
    direction: Optional[str] = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev only!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],


    
)



@app.post("/control")
def control(action: Action):
    print(f"received action: {action}")
    if action.type == "mouse_move" and action.x is not None and action.y is not None:
        pyautogui.moveTo(action.x, action.y)
        return {"status": "moved", "x": action.x, "y": action.y}
    elif action.type == "mouse_click":
        pyautogui.click()
        return {"status": "clicked"}
    elif action.type == "mouse_down":
        pyautogui.mouseDown()
        return {"status": "mouse_down"}
    elif action.type == "mouse_up":
        pyautogui.mouseUp()
        return {"status": "mouse_up"}
    elif action.type == "key_press" and hasattr(action, "key"):
        pyautogui.press(action.key)
        print(f"pressed {action.key}")
        return {"status": f"pressed {action.key}"}
    elif action.type == "scroll" and hasattr(action, "direction"):
        if action.direction == "up":
            pyautogui.scroll(50)  # positive for up, negative for down
        elif action.direction == "down":
            pyautogui.scroll(-50)
        return {"status": f"scrolled {action.direction}"}
    
    return {"status": "unknown action"}
