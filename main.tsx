import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
