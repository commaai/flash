const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    versions: process.versions,

    // USB device management
    onUsbDeviceAdded: (callback) => {
        ipcRenderer.on('usb-device-added', callback)
    },

    onUsbDeviceRemoved: (callback) => {
        ipcRenderer.on('usb-device-removed', callback)
    },

    // App management
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    // File system operations (if needed)
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
})

// Security: Remove global Node.js APIs
delete window.require
delete window.exports
delete window.module