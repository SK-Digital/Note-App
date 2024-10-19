const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    backgroundColor: '#1a1a1a',
    icon: path.join(__dirname, '../renderer/assets/icon.png'),
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  
  // Open DevTools automatically in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function setupIpcHandlers() {
  ipcMain.handle('save-note', async (event, note) => {
    const notesDir = path.join(app.getPath('userData'), 'notes');
    await fs.mkdir(notesDir, { recursive: true });
    const filePath = path.join(notesDir, `${note.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(note));
    return { success: true };
  });

  ipcMain.handle('load-notes', async () => {
    const notesDir = path.join(app.getPath('userData'), 'notes');
    try {
      await fs.mkdir(notesDir, { recursive: true });
      const files = await fs.readdir(notesDir);
      const notes = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(notesDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          return JSON.parse(content);
        })
      );
      return notes;
    } catch (error) {
      console.error('Error loading notes:', error);
      return [];
    }
  });

  ipcMain.handle('delete-note', async (event, noteId) => {
    const notesDir = path.join(app.getPath('userData'), 'notes');
    const filePath = path.join(notesDir, `${noteId}.json`);
    try {
      await fs.unlink(filePath);
      return { success: true };
    } catch (error) {
      console.error('Error deleting note:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('save-folders', async (event, folders) => {
    const foldersPath = path.join(app.getPath('userData'), 'folders.json');
    await fs.writeFile(foldersPath, JSON.stringify(folders));
    return { success: true };
  });

  ipcMain.handle('load-folders', async () => {
    const foldersPath = path.join(app.getPath('userData'), 'folders.json');
    try {
      const content = await fs.readFile(foldersPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error loading folders:', error);
      return [];
    }
  });

  ipcMain.handle('delete-folder', async (event, folderId) => {
    const foldersPath = path.join(app.getPath('userData'), 'folders.json');
    try {
      const content = await fs.readFile(foldersPath, 'utf-8');
      let folders = JSON.parse(content);
      folders = folders.filter(folder => folder.id !== folderId);
      await fs.writeFile(foldersPath, JSON.stringify(folders));
      return { success: true };
    } catch (error) {
      console.error('Error deleting folder:', error);
      return { success: false, error: error.message };
    }
  });
}
