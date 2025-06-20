// Minimal SolidJS entry point - direct and simple
import { render } from 'solid-js/web'
import { preloadCriticalAssets } from './utils/assets.js'
import App from './App.jsx'
import './index.css'

// Preload critical assets for better performance
if (typeof window !== 'undefined') {
  preloadCriticalAssets()
}

render(() => <App />, document.getElementById('root'))
