import { app, BrowserWindow, shell, dialog, ipcMain } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const isDev = process.env.NODE_ENV === 'development'

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (process.platform === 'win32') {
    try {
        const { default: setupEvents } = await import('electron-squirrel-startup')
        if (setupEvents) {
            app.quit()
        }
    } catch (e) {
        // electron-squirrel-startup is optional
    }
}

let mainWindow

// IPC handlers
ipcMain.handle('get-app-version', () => {
    return app.getVersion()
})

ipcMain.handle('show-open-dialog', async (event, options) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, options)
    if (canceled) {
        return { canceled: true }
    }
    return { canceled: false, filePaths }
})

ipcMain.handle('show-save-dialog', async (event, options) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, options)
    if (canceled) {
        return { canceled: true }
    }
    return { canceled: false, filePath }
})

const createWindow = () => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        icon: join(__dirname, '../src/app/icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: join(__dirname, 'preload.cjs'),
            webSecurity: true,
        },
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        show: false,
    })

    // Load the app
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173')
        // Open DevTools in development
        mainWindow.webContents.openDevTools()
    } else {
        mainWindow.loadFile(join(__dirname, '../dist/index.html'))
    }

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url)
        return { action: 'deny' }
    })

    // Prevent navigation to external websites
    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl)
        if (parsedUrl.origin !== 'http://localhost:5173' && !navigationUrl.startsWith('file://')) {
            event.preventDefault()
        }
    })
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
    // Set app user model ID for Windows
    if (process.platform === 'win32') {
        app.setAppUserModelId('ai.comma.flash')
    }

    createWindow()

    // Handle USB device permissions
    mainWindow.webContents.session.on('select-usb-device', (event, details, callback) => {
        // Add USB device selection logic here
        event.preventDefault()

        // Look for QDL devices (vendor ID 0x05C6, product ID 0x9008)
        const qdlDevice = details.deviceList.find(device =>
            device.vendorId === 0x05C6 && device.productId === 0x9008
        )

        if (qdlDevice) {
            callback(qdlDevice.deviceId)
        } else {
            callback()
        }
    })

    // Handle USB device access requests
    mainWindow.webContents.session.on('usb-device-added', (event, device) => {
        console.log('USB device added:', device)
        mainWindow.webContents.send('usb-device-added', device)
    })

    mainWindow.webContents.session.on('usb-device-removed', (event, device) => {
        console.log('USB device removed:', device)
        mainWindow.webContents.send('usb-device-removed', device)
    })

    // macOS specific behavior
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })

})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault()
        shell.openExternal(navigationUrl)
    })
})

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    if (isDev) {
        // In development, ignore certificate errors
        event.preventDefault()
        callback(true)
    } else {
        // In production, use default behavior
        callback(false)
    }
})

// Handle app protocol for auto-updater
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('flash-comma', process.execPath, [process.argv[1]])
    }
} else {
    app.setAsDefaultProtocolClient('flash-comma')
}