import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  const app = <App />;
  const useStrictMode = !import.meta.env.DEV || import.meta.env.VITE_STRICT_MODE === '1';
  root.render(useStrictMode ? <React.StrictMode>{app}</React.StrictMode> : app);
}
