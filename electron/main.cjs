const { app, BrowserWindow, shell, Menu } = require('electron')
const path = require('path')

function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 700, minHeight: 500,
    title: 'MarkItDown', icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  win.loadFile(path.join(__dirname, '../dist/index.html'))
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
}

Menu.setApplicationMenu(null)
app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
