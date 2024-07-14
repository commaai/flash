import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'

// import '@fontsource-variable/inter'
// import '@fontsource-variable/jetbrains-mono'

ReactDOM.hydrateRoot(
  document.getElementById('root'),
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
