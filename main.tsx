import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import logoSvg from './assets/logo.svg';

// Suppress Vite HMR WebSocket connection errors (expected in proxy environments)
// The proxy at daytonaproxy01.net does not forward WebSocket connections to Vite's HMR server.
const suppressPatterns = [
  /\[vite\].*websocket/i,
  /failed to connect.*websocket/i,
];
const originalError = console.error;
console.error = function (...args) {
  const message = args.map(a => String(a)).join(' ');
  if (suppressPatterns.some(p => p.test(message))) {
    return; // Fully suppress — Vite HMR is disabled server-side via hmr: false
  }
  originalError.apply(console, args);
};

// Also suppress WebSocket connection warnings from Vite 7
const originalWarn = console.warn;
console.warn = function (...args) {
  const message = args.map(a => String(a)).join(' ');
  if (suppressPatterns.some(p => p.test(message))) {
    return;
  }
  originalWarn.apply(console, args);
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
