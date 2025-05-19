// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fetch = require('node-fetch');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 450,
    show: false,  // Window is hidden
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL('http://localhost:3000');
}

app.whenReady().then(createWindow);

// Prevent app from quitting when all windows are closed
app.on('window-all-closed', (e) => {
  e.preventDefault();
});

ipcMain.on('gesture-action', async (event, action) => {
  console.log('Received gesture action:', action);
  // Only forward mouse_move actions with valid coordinates
  if (action.type === 'mouse_move' && typeof action.x === 'number' && typeof action.y === 'number') {
    try {
      await fetch('http://localhost:8000/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'mouse_move',
          x: action.x,
          y: action.y,
        }),
      });
    } catch (err) {
      console.error('Failed to send mouse_move to Python server:', err);
    }
  } else if (action.type === 'mouse_click') {
    try {
      await fetch('http://localhost:8000/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'mouse_click' }),
      });
    } catch (err) {
      console.error('Failed to send mouse_click to Python server:', err);
    }
  } else if (action.type === 'mouse_down') {
    try {
      await fetch('http://localhost:8000/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'mouse_down' }),
      });
    } catch (err) {
      console.error('Failed to send mouse_down to Python server:', err);
    }
  } else if (action.type === 'mouse_up') {
    try {
      await fetch('http://localhost:8000/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'mouse_up' }),
      });
    } catch (err) {
      console.error('Failed to send mouse_up to Python server:', err);
    }
  } else if (action.type === 'key_press' && action.key) {
    try {
      await fetch('http://localhost:8000/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'key_press', key: action.key }),
      });
    } catch (err) {
      console.error('Failed to send key_press to Python server:', err);
    }
  } else if (action.type === 'scroll' && action.direction) {
    console.log('Forwarding scroll to backend:', action);
    try {
      const response = await fetch('http://localhost:8000/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'scroll', direction: action.direction }),
      });
      const text = await response.text();
      if (!response.ok) {
        console.error('Backend rejected scroll:', response.status, text);
      } else {
        console.log('Backend scroll response:', response.status, text);
      }
    } catch (err) {
      console.error('Failed to send scroll to Python server:', err);
    }
  }
});

ipcMain.handle('show-recording-dialog', async () => {
  const script = `
    tell application "System Events"
      display dialog "Would you like to start hand gesture recording?" buttons {"Cancel", "Start Recording"} default button "Start Recording" with title "Hand Gesture Control"
      set button_pressed to button returned of result
      return button_pressed
    end tell
  `;

  try {
    const { stdout } = await new Promise((resolve, reject) => {
      exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve({ stdout, stderr });
      });
    });
    return stdout.trim() === "Start Recording";
  } catch (error) {
    return false;
  }
});