import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { AuthProvider } from './auth.tsx';
import { GamificationProvider } from './gamification.tsx';
import 'katex/dist/katex.min.css';
import './index.css';
import { ThemeProvider } from './theme.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {/* O app mora em /app/ (base do Vite); a raiz é do site público. */}
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AuthProvider>
          <GamificationProvider>
            <App />
          </GamificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
