import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { spawn, ChildProcess } from 'child_process'
import http from 'http'

let pythonProcess: ChildProcess | null = null
let restartCount = 0
const MAX_RESTARTS = 3
const PORT = 18420
let isQuitting = false

function startPythonSidecar(): void {
  if (isQuitting) return

  let pythonScript = join(app.getAppPath(), 'src/python/main.py')
  
  if (pythonScript.includes('app.asar')) {
    pythonScript = pythonScript.replace('app.asar', 'app.asar.unpacked')
  }

  let pythonCmd = 'python3'
  
  if (process.platform === 'win32') {
    pythonCmd = 'python'
  }

  console.log(`Spawning Python sidecar: ${pythonCmd} ${pythonScript} --port ${PORT}`)
  
  pythonProcess = spawn(pythonCmd, [pythonScript, '--port', PORT.toString()], {
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  })

  pythonProcess.stdout?.on('data', (data) => {
    console.log(`[Python Stdout]: ${data}`)
  })

  pythonProcess.stderr?.on('data', (data) => {
    console.error(`[Python Stderr]: ${data}`)
  })

  pythonProcess.on('error', (err) => {
    console.error(`Failed to start sidecar with ${pythonCmd}:`, err)
    // Fallback try with 'python' if python3 fails on macOS/Linux
    if (pythonCmd === 'python3' && process.platform !== 'win32') {
      console.log("Retrying sidecar with fallback 'python' command...")
      pythonCmd = 'python'
      pythonProcess = spawn(pythonCmd, [pythonScript, '--port', PORT.toString()], {
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      })
    }
  })

  pythonProcess.on('close', (code) => {
    console.log(`Sidecar exited with code ${code}`)
    pythonProcess = null
    
    // Auto restart up to 3 times if not quitting
    if (!isQuitting && restartCount < MAX_RESTARTS) {
      restartCount++
      console.log(`Restarting sidecar... (${restartCount}/${MAX_RESTARTS})`)
      setTimeout(startPythonSidecar, 2000)
    } else if (!isQuitting) {
      console.error('Python sidecar crashed too many times. Exiting sidecar manager.')
    }
  })
}

function stopPythonSidecar(): void {
  isQuitting = true
  if (pythonProcess) {
    console.log('Terminating Python sidecar process...')
    pythonProcess.kill('SIGTERM')
    pythonProcess = null
  }
}

// Health check polling: delay showing React window until fastapi is ready
function pollHealthCheck(callback: () => void): void {
  let attempts = 0
  const maxAttempts = 10
  
  const check = (): void => {
    attempts++
    console.log(`Polling sidecar health check (${attempts}/${maxAttempts})...`)
    const req = http.get(`http://127.0.0.1:${PORT}/health`, (res) => {
      if (res.statusCode === 200) {
        console.log('Python Sidecar is healthy and running!')
        callback()
      } else {
        retry()
      }
    })
    
    req.on('error', () => {
      retry()
    })
  }
  
  const retry = (): void => {
    if (attempts < maxAttempts) {
      setTimeout(check, 1000)
    } else {
      console.error('Sidecar health check timed out. Starting window anyway.')
      callback()
    }
  }
  
  check()
}

function createWindow(): void {
  // Create the browser window
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    title: 'NAtlas',
    minWidth: 800,   // macOS 및 Windows에서 창 축소가 안 되는 현상을 방지하기 위해 최소 너비 제한 지정
    minHeight: 600,  // macOS 및 Windows에서 창 축소가 안 되는 현상을 방지하기 위해 최소 높이 제한 지정
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Keyboard Zoom Shortcut Handler (Cmd/Ctrl + +, Cmd/Ctrl + -, Cmd/Ctrl + 0)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      const isCmdOrCtrl = process.platform === 'darwin' ? input.meta : input.control
      if (isCmdOrCtrl) {
        if (input.key === '-' || input.key === '_') {
          event.preventDefault()
          const currentZoom = mainWindow.webContents.getZoomLevel()
          mainWindow.webContents.setZoomLevel(Math.max(-3, currentZoom - 0.5))
        } else if (input.key === '=' || input.key === '+') {
          event.preventDefault()
          const currentZoom = mainWindow.webContents.getZoomLevel()
          mainWindow.webContents.setZoomLevel(Math.min(3, currentZoom + 0.5))
        } else if (input.key === '0') {
          event.preventDefault()
          mainWindow.webContents.setZoomLevel(0)
        }
      }
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer based on electron-vite cli
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Set app name explicitly for macOS menu bar and integration
app.setName('NAtlas')

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.nsoftamerica.natlas')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register open folder dialog IPC handler
  ipcMain.handle('open-folder-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return canceled ? null : filePaths[0]
  })

  // Register open external browser IPC handler
  ipcMain.handle('open-external', async (_, url) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      await shell.openExternal(url)
    }
  })

  // Start sidecar process
  startPythonSidecar()

  // Wait for sidecar to start before rendering main window
  pollHealthCheck(createWindow)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Teardown python process before quit
app.on('before-quit', () => {
  stopPythonSidecar()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
