// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fetch = require('node-fetch'); // npm install node-fetch

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

  // Load your Next.js app (adjust if using a different port or build)
  win.loadURL('http://localhost:3000');
}

app.whenReady().then(createWindow);

ipcMain.on('gesture-action', async (event, action) => {
  console.log('Received gesture action:', action);
  try {
    await fetch('http://localhost:8000/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    });
  } catch (err) {
    console.error('Failed to send action to Python server:', err);
  }
});