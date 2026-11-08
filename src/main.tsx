import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import { useApp } from './store'
import { HAS_VRM } from './body/VrmMannequin'

// 網上版冇 VRM：之前揀咗 VRM 就轉返少女
if (!HAS_VRM && useApp.getState().style === 'vrm') useApp.getState().setStyle('girl')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 正式版先啟用離線支援（開發時唔用，避免快取舊程式）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}))
}
