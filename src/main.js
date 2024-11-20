import React from 'react'
import ReactDOM from 'react-dom'
import App from './app/App.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(React.StrictMode, null,
    React.createElement(App, null)
  )
)