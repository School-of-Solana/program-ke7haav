import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { Buffer } from 'buffer'

// Make Buffer available globally for Solana libraries
window.Buffer = Buffer
;(globalThis as any).Buffer = Buffer

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

