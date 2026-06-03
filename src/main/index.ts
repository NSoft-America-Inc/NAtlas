import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { spawn, ChildProcess } from 'child_process'
import http from 'http'

let pythonProcess: ChildProcess | null = null
let mainWindow: BrowserWindow | null = null
let restartCount = 0
const MAX_RESTARTS = 3
const PORT = 18420
let isQuitting = false

function cleanupExistingSidecar(): Promise<void> {
  return new Promise((resolve) => {
    console.log('Cleaning up existing sidecar processes on port 18420...')
    const isWin = process.platform === 'win32'
    const exec = require('child_process').exec

    if (isWin) {
      // Windows: Find process by port 18420 and kill it
      const cmd = `for /f "tokens=5" %a in ('netstat -aon ^| findstr 18420') do taskkill /F /PID %a`
      exec(cmd, (err) => {
        if (err) {
          console.log('No existing Windows sidecar process to kill.')
        } else {
          console.log('Killed existing Windows sidecar process.')
        }
        resolve()
      })
    } else {
      // macOS/Linux: Kill by port using lsof and pkill
      exec('lsof -t -i:18420 | xargs kill -9', () => {
        exec('pkill -9 -f uvicorn', () => {
          console.log('Cleaned up existing macOS sidecar processes.')
          resolve()
        })
      })
    }
  })
}

async function startPythonSidecar(): Promise<void> {
  if (isQuitting) return

  // 1. 좀비 프로세스 사전 클린업 수행
  await cleanupExistingSidecar()

  let pythonScript = join(app.getAppPath(), 'src/python/main.py')

  if (pythonScript.includes('app.asar')) {
    pythonScript = pythonScript.replace('app.asar', 'app.asar.unpacked')
  }

  const fs = require('fs')
  const os = require('os')

  const isWin = process.platform === 'win32'
  let pythonCmd = isWin ? 'python' : 'python3'

  // 0. Embedded resources/python (최우선: packaged DMG/EXE 배포 환경)
  const resourcesDir = app.getAppPath().includes('app.asar')
    ? join(app.getAppPath(), '..')
    : join(app.getAppPath(), 'resources')
  const embeddedPythonBin = isWin
    ? join(resourcesDir, 'python', 'python.exe')
    : join(resourcesDir, 'python', 'bin', 'python3')

  // 1. Local workspace .venv
  let localVenvDir = join(app.getAppPath(), 'src/python/.venv')
  if (localVenvDir.includes('app.asar')) {
    localVenvDir = localVenvDir.replace('app.asar', 'app.asar.unpacked')
  }
  const localPythonBin = isWin
    ? join(localVenvDir, 'Scripts/python.exe')
    : join(localVenvDir, 'bin/python')

  // 2. Global user home .natlas/venv
  const globalVenvDir = join(os.homedir(), '.natlas/venv')
  const globalPythonBin = isWin
    ? join(globalVenvDir, 'Scripts/python.exe')
    : join(globalVenvDir, 'bin/python')

  if (fs.existsSync(localPythonBin)) {
    pythonCmd = localPythonBin
    console.log(`Using local workspace venv python: ${pythonCmd}`)
  } else if (fs.existsSync(globalPythonBin)) {
    pythonCmd = globalPythonBin
    console.log(`Using global user home venv python: ${pythonCmd}`)
  } else if (fs.existsSync(embeddedPythonBin)) {
    pythonCmd = embeddedPythonBin
    console.log(`Using embedded resources/python: ${pythonCmd}`)
  } else {
    console.log(`No venv/embedded python found. Falling back to system python: ${pythonCmd}`)
  }

  console.log(`Spawning Python sidecar: ${pythonCmd} ${pythonScript} --port ${PORT}`)

  pythonProcess = spawn(pythonCmd, [pythonScript, '--port', PORT.toString()], {
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      NATLAS_VERSION: app.getVersion()
    }
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
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          NATLAS_VERSION: app.getVersion()
        }
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
  const win = new BrowserWindow({
    width: 1000,
    height: 750,
    title: 'NAtlas',
    minWidth: 800, // macOS 및 Windows에서 창 축소가 안 되는 현상을 방지하기 위해 최소 너비 제한 지정
    minHeight: 600, // macOS 및 Windows에서 창 축소가 안 되는 현상을 방지하기 위해 최소 높이 제한 지정
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow = win

  win.on('ready-to-show', () => {
    win.show()
  })

  // Keyboard Zoom Shortcut Handler (Cmd/Ctrl + +, Cmd/Ctrl + -, Cmd/Ctrl + 0)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      const isCmdOrCtrl = process.platform === 'darwin' ? input.meta : input.control
      if (isCmdOrCtrl) {
        if (input.key === '-' || input.key === '_') {
          event.preventDefault()
          const currentZoom = win.webContents.getZoomLevel()
          win.webContents.setZoomLevel(Math.max(-3, currentZoom - 0.5))
        } else if (input.key === '=' || input.key === '+') {
          event.preventDefault()
          const currentZoom = win.webContents.getZoomLevel()
          win.webContents.setZoomLevel(Math.min(3, currentZoom + 0.5))
        } else if (input.key === '0') {
          event.preventDefault()
          win.webContents.setZoomLevel(0)
        }
      }
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer based on electron-vite cli
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Set app name explicitly for macOS menu bar and integration
app.setName('NAtlas')

function initEmbeddedRuntime(): void {
  const isWin = process.platform === 'win32'

  // Resolve resources path
  const resourcesDir = app.getAppPath().includes('app.asar')
    ? join(app.getAppPath(), '..')
    : join(app.getAppPath(), 'resources')

  let embeddedNodeDir = isWin ? join(resourcesDir, 'node') : join(resourcesDir, 'node', 'bin')

  let embeddedGitDir = isWin ? join(resourcesDir, 'git', 'cmd') : join(resourcesDir, 'git', 'bin')

  if (embeddedNodeDir.includes('app.asar')) {
    embeddedNodeDir = embeddedNodeDir.replace('app.asar', 'app.asar.unpacked')
  }
  if (embeddedGitDir.includes('app.asar')) {
    embeddedGitDir = embeddedGitDir.replace('app.asar', 'app.asar.unpacked')
  }

  const pathSeparator = isWin ? ';' : ':'
  const extraPaths = `${embeddedNodeDir}${pathSeparator}${embeddedGitDir}`

  process.env.PATH = `${extraPaths}${pathSeparator}${process.env.PATH || ''}`
  console.log(`Embedded PATH resolution initialized: ${process.env.PATH}`)
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Initialize embedded Node/Git runtime path redirection
  initEmbeddedRuntime()

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

  // Register run core installer IPC handler
  ipcMain.handle('run-core-installer', async (_, { scenario }) => {
    return new Promise((resolve) => {
      console.log(`IPC request to run core installer. Scenario: ${scenario}`)

      const isWin = process.platform === 'win32'
      const shellCmd = isWin ? 'powershell.exe' : 'bash'
      const scriptFile = isWin ? 'install_unified.ps1' : 'install_unified.sh'

      let installerScript = join(app.getAppPath(), scriptFile)
      if (installerScript.includes('app.asar')) {
        installerScript = installerScript.replace('app.asar', 'app.asar.unpacked')
      }

      console.log(`Running unified installer script: ${installerScript} using ${shellCmd}`)

      const runCwd = app.getAppPath().includes('app.asar')
        ? join(app.getAppPath(), '..')
        : app.getAppPath()

      const spawnArgs = isWin
        ? ['-ExecutionPolicy', 'Bypass', '-File', installerScript]
        : [installerScript]

      let installModeEnv = '0'
      if (scenario === 'core') {
        installModeEnv = '0'
      } else if (scenario === 'project') {
        installModeEnv = '2'
      } else if (scenario === 'e2e') {
        installModeEnv = '0'
      } else if (scenario !== undefined) {
        installModeEnv = scenario.toString()
      }

      const extraPaths = process.platform === 'darwin' ? ':/opt/homebrew/bin:/usr/local/bin' : ''
      const systemPath = (process.env.PATH || '') + extraPaths

      // Read github_token from ~/.natlas/config.json to pass to installer
      let nstackGithubToken = ''
      try {
        const configPath = require('path').join(require('os').homedir(), '.natlas', 'config.json')
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
          nstackGithubToken = config.github_token || ''
        }
      } catch (_) { /* ignore */ }

      const installerProcess = spawn(shellCmd, spawnArgs, {
        cwd: runCwd,
        env: {
          ...process.env,
          PATH: systemPath,
          INSTALL_MODE: installModeEnv,
          TERM: 'dumb',
          ...(nstackGithubToken ? { NSTACK_GITHUB_TOKEN: nstackGithubToken } : {})
        }
      })


      installerProcess.stdout?.on('data', (data) => {
        const log = data.toString()
        console.log(`[Installer Stdout]: ${log}`)
        if (mainWindow) {
          mainWindow.webContents.send('installer-log', log)
        }
      })

      installerProcess.stderr?.on('data', (data) => {
        const log = data.toString()
        console.error(`[Installer Stderr]: ${log}`)
        if (mainWindow) {
          mainWindow.webContents.send('installer-log', log)
        }
      })

      installerProcess.on('error', (err) => {
        console.error('Failed to run unified installer:', err)
        resolve({ success: false, error: err.message })
      })

      installerProcess.on('close', (code) => {
        console.log(`Unified installer process closed with code ${code}`)
        if (code === 0) {
          console.log('Installation succeeded. Restarting python sidecar...')
          startPythonSidecar()
          resolve({ success: true })
        } else {
          resolve({ success: false, error: `Process exited with code ${code}` })
        }
      })
    })
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
