import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Marker for checking that setting changes never reload the page: it logs once per page load.
console.info('[Stretcher] app mounted', new Date().toISOString())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
