import Alpine from 'alpinejs'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import { appComponent, copyTextComponent } from './alpine-app'
import { flashComponent } from './alpine-flash'

// Register Alpine components
Alpine.data('app', appComponent)
Alpine.data('copyText', copyTextComponent)
Alpine.data('flash', flashComponent)

// Start Alpine.js
window.Alpine = Alpine
Alpine.start()

console.info('Alpine.js application started')