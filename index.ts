import { registerRootComponent } from 'expo';
import App from './App';

// Lock dark background and prevent outer window scrolling/overscroll white flashes on web
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.id = 'lumo-web-dark-theme-reset';
  style.textContent = `
    html, body, #root {
      width: 100% !important;
      height: 100% !important;
      height: 100dvh !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      background-color: #0B101B !important;
      overscroll-behavior: none !important;
      -webkit-overflow-scrolling: touch !important;
    }
  `;
  document.head.appendChild(style);
}

registerRootComponent(App);
