import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'

import './index.css'
import App from './app/App.svelte'

// Use Svelte 4's component instantiation API
const app = new App({
  target: document.getElementById('root')
})

export default app
