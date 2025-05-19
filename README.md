# HandJob - Hand Gesture Control

Control your Mac with hand gestures using your webcam.

## Setup

1. Install dependencies:
```bash
# Frontend
npm install

# Backend (in backend directory)
python3 -m pip install fastapi uvicorn pyautogui
```

2. Start the services:
```bash
# Terminal 1: Start backend
cd backend
python3 -m uvicorn main:app --reload

# Terminal 2: Start frontend
npm run dev

# Terminal 3: Start Electron
npm run electron
```

## Usage

1. When launched, you'll get a dialog asking to start hand gesture recording
2. Allow camera access when prompted
3. Use these gestures:
   - 👌 Pinch: Click
   - ✌️ Two fingers up/down: Scroll
   - 🤟 L shape: Press Enter
   - 🖕 Middle finger: Press Delete
   - ☝️👆 Index+Middle pinch: Drag and drop



