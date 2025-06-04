# flash

► [flash.comma.ai](https://flash.comma.ai)

This tool allows you to flash AGNOS onto your comma device. AGNOS is the Ubuntu-based operating system for your [comma 3/3X](https://comma.ai/shop/comma-3x).

Built with SvelteKit for instant loading and optimal performance. Uses [qdl.js](https://github.com/commaai/qdl.js) for WebUSB-based device flashing.

## Features

- **🚀 Instant Loading** - Static site generation with progressive enhancement
- **📱 WebUSB Support** - Direct browser-to-device communication
- **⚡ Fast Performance** - SvelteKit with optimized bundles
- **🌙 Dark Mode** - Automatic dark/light theme support
- **📖 Comprehensive Guide** - Step-by-step flashing instructions
- **🔧 Platform Support** - Windows, macOS, Linux, Android

## Technology Stack

- **Framework**: SvelteKit with static adapter
- **Styling**: Tailwind CSS v4
- **Device Communication**: WebUSB + QDL protocol
- **Compression**: XZ decompression for image files
- **Build Tool**: Vite with optimized chunking
- **Testing**: Vitest with UI and coverage

## Development

### Prerequisites

- Node.js 20.11.0 or higher
- A WebUSB-compatible browser (Chrome, Edge, Opera)
- For dependencies: either npm or bun

### Setup

```bash
# Clone the repository
git clone https://github.com/commaai/flash.git
cd flash

# Install dependencies
npm install
# OR
bun install

# Start development server
npm run dev
# OR  
bun dev
```

Open [http://localhost:5173](http://localhost:5173) with your browser to see the result.

### Available Scripts

```bash
# Development
npm run dev          # Start dev server with HMR
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Check for linting errors
npm run lint:fix     # Fix linting errors
npm run format       # Format code with Prettier
npm run type-check   # Run TypeScript checks

# Testing
npm run test         # Run tests
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage
```

### Project Structure

```
src/
├── routes/
│   ├── +layout.svelte          # Global layout
│   └── +page.svelte            # Main page
├── lib/
│   ├── components/             # Reusable components
│   │   ├── AppHeader.svelte    
│   │   ├── Requirements.svelte
│   │   ├── Instructions.svelte
│   │   ├── Flash.svelte        # Main flash interface
│   │   └── ...
│   ├── stores/
│   │   └── flash.js            # Flash state management
│   ├── flash/                  # Core flash logic
│   │   ├── manager.js          # FlashManager class
│   │   ├── image.js            # Image handling
│   │   ├── manifest.js         # Manifest parsing
│   │   └── ...
│   └── utils/                  # Utilities
│       ├── platform.js         # Platform detection
│       └── config.js           # Configuration
└── static/                     # Static assets
    ├── assets/                 # Images and icons
    └── favicon.ico
```

## Supported Devices

- **comma 3** - All UFS variants
- **comma 3X** - 128GB models

The tool automatically detects your device type and selects the appropriate firmware images.

## Browser Requirements

- **Chrome 61+**, **Edge 79+**, or **Opera 48+**
- **WebUSB support** (not available in Firefox or Safari)
- **Modern JavaScript features** (ES2020+)

## Building for Production

```bash
# Build static site
npm run build

# The build output will be in the `build/` directory
# Deploy the contents to any static hosting service
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Run the linting and formatting: `npm run lint:fix && npm run format`
5. Submit a pull request

## Performance Optimizations

- **Code Splitting** - Heavy dependencies loaded on-demand
- **Static Generation** - Pre-rendered HTML for instant loading
- **Asset Optimization** - Compressed images and fonts
- **Bundle Analysis** - Separate chunks for vendor libraries
- **Progressive Enhancement** - Works without JavaScript, enhanced with it

## Support

- **Discord**: Join [#hw-three-3x](https://discord.comma.ai) for help
- **Documentation**: See the in-app instructions for detailed setup guides
- **Issues**: Report problems on the GitHub issues page