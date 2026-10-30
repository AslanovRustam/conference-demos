import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { brandLogo } from '@brand/tokens';
import { App } from './App';
import './styles/global.css';

const favicon = document.createElement('link');
favicon.rel = 'icon';
favicon.href = brandLogo.favicon;
document.head.appendChild(favicon);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
