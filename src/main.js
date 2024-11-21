import React from 'react'
import ReactDOM from 'react-dom'
import Flash from './app/Flash.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(React.StrictMode, null,
    React.createElement(Flash, null)
  )
)