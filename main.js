// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');


const fetch = require('node-fetch'); // Make sure you're using node-fetch@2

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL('http://localhost:3000');
}

app.whenReady().then(createWindow);

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