import { mount } from 'svelte'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'

import './index.css'
import App from './app/App.svelte'

const app = mount(App, {
  target: document.getElementById('root'),
})

export default app
