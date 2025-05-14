from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pyautogui
from typing import Optional
import time

# Disable pyautogui's built-in delays and safety features
pyautogui.MINIMUM_DURATION = 0
pyautogui.MINIMUM_SLEEP = 0
pyautogui.PAUSE = 0
pyautogui.FAILSAFE = False  # Be careful with this!

class Action(BaseModel):
    type: str
    x: Optional[int] = None
    y: Optional[int] = None
    key: Optional[str] = None
    direction: Optional[str] = None
    duration: Optional[float] = None

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/control")
def control(action: Action):
    print(f"received action: {action}")
    if action.type == "mouse_move" and action.x is not None and action.y is not None:
        pyautogui.moveTo(action.x, action.y, duration=0)
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
        base_scroll_amount_per_tick = 8  # Initial scroll amount per tick
        acceleration_rate = 15          # How much speed increases per second of holding
        max_scroll_amount_per_tick = 100 # Maximum scroll amount per tick
        
        current_total_scroll_for_this_tick = base_scroll_amount_per_tick
        
        if action.duration is not None and action.duration > 0:
            # Linear acceleration: speed = base + (duration * rate)
            accelerated_amount = int(action.duration * acceleration_rate)
            current_total_scroll_for_this_tick += accelerated_amount
            
        current_total_scroll_for_this_tick = min(current_total_scroll_for_this_tick, max_scroll_amount_per_tick)

        # To make each individual tick's scroll action smooth
        scroll_unit_per_pyautogui_call = 4 # Smaller units for pyautogui.scroll()
        num_pyautogui_calls_for_this_tick = max(1, current_total_scroll_for_this_tick // scroll_unit_per_pyautogui_call)
        
        # Distribute the total scroll amount for this tick among the calls
        actual_scroll_per_call = current_total_scroll_for_this_tick // num_pyautogui_calls_for_this_tick
        remainder = current_total_scroll_for_this_tick % num_pyautogui_calls_for_this_tick
        
        delay_between_pyautogui_calls = 0.004 # Small delay for smoothness of each tick

        if action.direction == "up":
            for i in range(num_pyautogui_calls_for_this_tick):
                scroll_this_time = actual_scroll_per_call + (1 if i < remainder else 0)
                if scroll_this_time > 0: # Ensure we scroll by a positive amount
                    pyautogui.scroll(scroll_this_time)
                    time.sleep(delay_between_pyautogui_calls)
        elif action.direction == "down":
            for i in range(num_pyautogui_calls_for_this_tick):
                scroll_this_time = actual_scroll_per_call + (1 if i < remainder else 0)
                if scroll_this_time > 0: # Ensure we scroll by a positive amount
                    pyautogui.scroll(-scroll_this_time)
                    time.sleep(delay_between_pyautogui_calls)
        
        print(f"Scrolled {action.direction} by {current_total_scroll_for_this_tick} (duration: {action.duration:.2f}s)")
        return {"status": f"scrolled {action.direction} by {current_total_scroll_for_this_tick}"}
    
    return {"status": "unknown action"}
