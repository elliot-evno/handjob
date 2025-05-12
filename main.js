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
  }
});