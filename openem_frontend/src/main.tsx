import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { AuthProvider } from './auth.tsx';
import { GamificationProvider } from './gamification.tsx';
// Fontes servidas pelo próprio app (sem Google Fonts): o IP do aluno não vai
// para terceiros e a fonte vem junto no cache offline. Os nomes registrados
// ("… Variable") estão nos tokens --font-* do index.css.
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/jetbrains-mono/index.css';
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
