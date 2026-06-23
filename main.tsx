import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import logoSvg from './assets/logo.svg';

// Filter out Vite HMR WebSocket connection errors (harmless in proxy environments)
const originalError = console.error;
console.error = function (...args) {
  const message = args.map(a => String(a)).join(' ');
  if (message.includes('[vite]') && message.includes('websocket')) {
    // Suppress - this is expected when Vite HMR tries to connect through the proxy
    originalError.apply(console, args); // Keep it in the browser console for debugging
    return; // Don't forward to the parent as an application error
  }
  originalError.apply(console, args);
};

// Set favicon
const link = document.querySelector('link[rel="icon"]') || document.createElement('link');
if (link instanceof HTMLLinkElement) {
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = logoSvg;
  document.head.appendChild(link);
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
