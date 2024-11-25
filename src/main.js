import { h, render } from 'preact'
import Flash from './app/Flash.js'

render(h(Flash, null), document.getElementById('root'))

// ReactDOM.createRoot(document.getElementById('root')).render(
//   React.createElement(React.StrictMode, null,
//     React.createElement(Flash, null)
//   )
// )