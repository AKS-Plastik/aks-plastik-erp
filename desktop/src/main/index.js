import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
import { spawn, spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { SerialPort } from 'serialport'
import { ReadlineParser } from '@serialport/parser-readline'
import * as keycloak from './keycloak.js'

const isDev = !app.isPackaged

// ── Serial port management ──
let activePort = null
let activeParser = null

ipcMain.handle('serial:list', async () => {
  const ports = await SerialPort.list()
  return ports.map((p) => ({ path: p.path, manufacturer: p.manufacturer || '', vendorId: p.vendorId || '' }))
})

ipcMain.handle('serial:open', (_, { path, baudRate }) => {
  return new Promise((resolve) => {
    if (activePort?.isOpen) {
      activePort.close(() => {
        activePort = null
        activeParser = null
        openPort(path, baudRate, resolve)
      })
    } else {
      openPort(path, baudRate, resolve)
    }
  })
})

function openPort(path, baudRate, resolve) {
  activePort = new SerialPort({ path, baudRate: parseInt(baudRate), autoOpen: false })
  activeParser = activePort.pipe(new ReadlineParser({ delimiter: '\r\n' }))

  activeParser.on('data', (line) => {
    const wins = BrowserWindow.getAllWindows()
    wins.forEach((w) => w.webContents.send('serial:data', line))
  })

  activePort.on('error', (err) => {
    const wins = BrowserWindow.getAllWindows()
    wins.forEach((w) => w.webContents.send('serial:error', err.message))
  })

  activePort.on('close', () => {
    const wins = BrowserWindow.getAllWindows()
    wins.forEach((w) => w.webContents.send('serial:closed'))
    activePort = null
    activeParser = null
  })

  activePort.open((err) => {
    if (err) resolve({ ok: false, error: err.message })
    else resolve({ ok: true })
  })
}

ipcMain.handle('serial:write', (_, data) => {
  if (!activePort?.isOpen) return { ok: false, error: 'Port not open' }
  return new Promise((resolve) => {
    activePort.write(data + '\r\n', (err) => {
      if (err) resolve({ ok: false, error: err.message })
      else resolve({ ok: true })
    })
  })
})

ipcMain.handle('serial:close', () => {
  return new Promise((resolve) => {
    if (!activePort?.isOpen) return resolve({ ok: true })
    activePort.close((err) => {
      activePort = null
      activeParser = null
      if (err) resolve({ ok: false, error: err.message })
      else resolve({ ok: true })
    })
  })
})

// Run a Python script and return output
ipcMain.handle('python:run', (_, code) => {
  return new Promise((resolve) => {
    const py = spawn('python', ['-u', '-c', code], {
      timeout: 60000,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    })

    let stdout = ''
    let stderr = ''

    py.stdout.on('data', (data) => { stdout += data.toString() })
    py.stderr.on('data', (data) => { stderr += data.toString() })

    py.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode })
    })

    py.on('error', (err) => {
      resolve({ stdout: '', stderr: err.message, exitCode: 1 })
    })
  })
})

// Check if Python is installed
ipcMain.handle('python:check', () => {
  return new Promise((resolve) => {
    const py = spawn('python', ['--version'])
    let version = ''
    py.stdout.on('data', (data) => { version += data.toString() })
    py.stderr.on('data', (data) => { version += data.toString() })
    py.on('close', (code) => resolve(code === 0 ? version.trim() : null))
    py.on('error', () => resolve(null))
  })
})

// ── STM32 Programmer CLI ──
const STM32_CLI_PATHS = process.platform === 'win32'
  ? [
      'STM32_Programmer_CLI.exe',
      'C:\\Program Files\\STMicroelectronics\\STM32Cube\\STM32CubeProgrammer\\bin\\STM32_Programmer_CLI.exe',
      'C:\\Program Files (x86)\\STMicroelectronics\\STM32Cube\\STM32CubeProgrammer\\bin\\STM32_Programmer_CLI.exe',
    ]
  : [
      'STM32_Programmer_CLI',
      `/home/${process.env.USER}/STMicroelectronics/STM32Cube/STM32CubeProgrammer/bin/STM32_Programmer_CLI`,
      '/usr/local/bin/STM32_Programmer_CLI',
      '/opt/st/stm32cube/STM32CubeProgrammer/bin/STM32_Programmer_CLI',
    ]

let stm32CliPath = null

ipcMain.handle('stm32:findCli', async () => {
  for (const p of STM32_CLI_PATHS) {
    if (existsSync(p)) { stm32CliPath = p; return { found: true, path: p } }
    try {
      const r = spawnSync(p, ['--version'], { timeout: 3000 })
      if (!r.error) { stm32CliPath = p; return { found: true, path: p } }
    } catch {}
  }
  return { found: false, path: null }
})

ipcMain.handle('stm32:setCli', (_, path) => { stm32CliPath = path; return { ok: true } })

ipcMain.handle('stm32:browseCli', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Locate STM32_Programmer_CLI',
    filters: process.platform === 'win32'
      ? [{ name: 'Executable', extensions: ['exe'] }]
      : [{ name: 'All Files', extensions: ['*'] }],
    properties: ['openFile'],
  })
  if (res.canceled || !res.filePaths.length) return { canceled: true }
  stm32CliPath = res.filePaths[0]
  return { canceled: false, path: stm32CliPath }
})

ipcMain.handle('stm32:selectFile', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Select Firmware File',
    filters: [{ name: 'Firmware', extensions: ['bin', 'hex', 'elf'] }, { name: 'All Files', extensions: ['*'] }],
    properties: ['openFile'],
  })
  if (res.canceled || !res.filePaths.length) return { canceled: true }
  return { canceled: false, path: res.filePaths[0] }
})

ipcMain.handle('stm32:run', (_, args) => {
  return new Promise((resolve) => {
    if (!stm32CliPath) { resolve({ ok: false, error: 'CLI not configured' }); return }
    const wins = BrowserWindow.getAllWindows()
    const sendLog = (text, type) => wins.forEach((w) => w.webContents.send('stm32:log', { text, type }))
    sendLog(`$ ${[stm32CliPath, ...args].join(' ')}`, 'cmd')
    const proc = spawn(stm32CliPath, args, { env: process.env })
    proc.stdout.on('data', (d) => d.toString().split('\n').filter(Boolean).forEach((l) => sendLog(l, 'info')))
    proc.stderr.on('data', (d) => d.toString().split('\n').filter(Boolean).forEach((l) => sendLog(l, 'err')))
    proc.on('close', (code) => { sendLog(`Exited with code ${code}`, code === 0 ? 'ok' : 'err'); resolve({ ok: code === 0, exitCode: code }) })
    proc.on('error', (err) => { sendLog(`Error: ${err.message}`, 'err'); resolve({ ok: false, error: err.message }) })
  })
})

// ── Keycloak auth ──
ipcMain.handle('auth:login', async () => {
  const { verifier, state, authUrl } = keycloak.buildAuthRequest()

  return new Promise((resolve, reject) => {
    const loginWin = new BrowserWindow({
      width: 520,
      height: 700,
      resizable: false,
      title: 'AKS — Sign In',
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })

    loginWin.setMenuBarVisibility(false)
    loginWin.loadURL(authUrl)

    let handled = false

    async function handleCallback(url) {
      if (handled || !url.startsWith(keycloak.REDIRECT_URI)) return
      handled = true
      loginWin.destroy()
      try {
        const parsed = new URL(url)
        const error = parsed.searchParams.get('error')
        if (error) throw new Error(parsed.searchParams.get('error_description') || error)
        const code = parsed.searchParams.get('code')
        const returnedState = parsed.searchParams.get('state')
        if (returnedState !== state) throw new Error('State mismatch — possible CSRF')
        if (!code) throw new Error('No authorization code received')
        const tokens = await keycloak.exchangeCode(code, verifier)
        resolve({ ok: true, tokens })
      } catch (err) {
        resolve({ ok: false, error: err.message })
      }
    }

    loginWin.webContents.on('will-redirect', (_, url) => handleCallback(url))
    loginWin.webContents.on('will-navigate', (_, url) => handleCallback(url))
    loginWin.on('closed', () => {
      if (!handled) resolve({ ok: false, error: 'Login cancelled' })
    })
  })
})

ipcMain.handle('auth:refresh', async (_, refreshToken) => {
  try {
    const tokens = await keycloak.refreshAccessToken(refreshToken)
    return { ok: true, tokens }
  } catch {
    return { ok: false }
  }
})

ipcMain.handle('auth:logout', async (_, refreshToken) => {
  if (refreshToken) await keycloak.revokeToken(refreshToken)
  return { ok: true }
})

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 360,
    minHeight: 600,
    show: false,
    title: 'AKS CRM Dashboard',
    icon: isDev
      ? join(__dirname, '../../src/main/aks_logo.png')
      : join(__dirname, 'aks_logo.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall())

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  if (!isDev) {
    const sendToAll = (channel, data) =>
      BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(channel, data))

    autoUpdater.autoDownload = true
    autoUpdater.on('update-available',   (info)     => sendToAll('updater:update-available', info))
    autoUpdater.on('download-progress',  (progress) => sendToAll('updater:download-progress', progress))
    autoUpdater.on('update-downloaded',  (info)     => sendToAll('updater:update-downloaded', info))

    autoUpdater.checkForUpdates()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
