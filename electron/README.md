# Electron Desktop App

This document explains how to build and run the flash.comma.ai app as a cross-platform desktop application using Electron and Bun.

## Development

### Prerequisites
- Node.js >= 20.11.0
- Bun (latest version)

### Installation
```bash
bun install
```

### Development Mode
To run the app in development mode with hot reload:

```bash
bun run electron-dev
```

This will:
1. Start the Vite dev server with Bun
2. Wait for it to be ready
3. Launch Electron pointing to the dev server

### Building for Production

#### Build for current platform
```bash
bun run electron-build
```

#### Build for specific platforms
```bash
bun run electron-build-win    # Windows
bun run electron-build-mac    # macOS  
bun run electron-build-linux  # Linux
```

#### Build for all platforms
```bash
bun run electron-build-all
```

## Platform-Specific Notes

### Windows
- The app will be packaged as an NSIS installer
- USB drivers may need to be installed separately using Zadig
- Admin privileges may be required for USB device access

### macOS
- The app will be packaged as a DMG
- Code signing may be required for distribution
- USB device access should work out of the box

### Linux
- The app will be packaged as both AppImage and .deb
- USB device permissions may need to be configured via udev rules
- Run with `sudo` if USB access fails

## USB Device Access

The Electron app automatically handles USB device permissions for QDL devices (VID: 0x05C6, PID: 0x9008). However, some platforms may require additional setup:

### Linux USB Permissions
Create a udev rule to allow access to QDL devices:

```bash
# Create udev rule
sudo tee /etc/udev/rules.d/51-comma-qdl.rules > /dev/null <<EOF
SUBSYSTEM=="usb", ATTR{idVendor}=="05c6", ATTR{idProduct}=="9008", MODE="0666", GROUP="plugdev"
EOF

# Reload udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger
```

Add your user to the plugdev group:
```bash
sudo usermod -a -G plugdev $USER
```

Log out and back in for the group change to take effect.

## ES Modules Support

The project uses ES modules throughout, including the main Electron process. The preload script uses CommonJS (`.cjs` extension) as required by Electron.

## Security Features

The Electron app implements several security best practices:

- Context isolation enabled
- Node integration disabled
- Preload script for secure IPC
- Content Security Policy
- External link handling
- USB device filtering

## Auto-Updates

The app includes electron-updater for automatic updates. Configure your update server in the build configuration to enable this feature.

## Troubleshooting

### USB Device Not Detected
1. Ensure the device is in QDL mode
2. Check that drivers are installed (Windows)
3. Verify USB permissions (Linux)
4. Try a different USB cable or port

### Build Issues
1. Clear node_modules and reinstall: `bun install --force`
2. Ensure you have the latest version of electron-builder
3. Check that all required build tools are installed

### App Won't Start
1. Check the console for error messages
2. Ensure the dist folder exists and contains built files
3. Try running in development mode first

### ES Module Issues
If you encounter module-related errors:
1. Ensure all `.js` files in `electron/` use ES module syntax
2. The preload script should use `.cjs` extension and CommonJS syntax
3. Check that `"type": "module"` is set in package.json

## File Structure

```
electron/
├── main.js          # Main Electron process (ES modules)
├── preload.cjs      # Preload script (CommonJS)
└── (old files)      # Can be removed

dist/                # Built web app (created by Vite)
release/             # Electron build output
```

## Bun-Specific Notes

- All scripts use `bun run` instead of `npm run`
- Dependencies are installed with `bun add` instead of `npm install`
- Bun provides faster installation and execution compared to npm
- The development server starts faster with Bun