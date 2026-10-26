import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import '../styles.css';
import { Legal } from './Legal';

const raiz = document.getElementById('root')!;
const app = (
  <StrictMode>
    <Legal url={window.location.pathname} />
  </StrictMode>
);

// No build a página chega pré-renderizada (scripts/prerender.mjs); no dev, não.
if (raiz.firstElementChild) hydrateRoot(raiz, app);
else createRoot(raiz).render(app);
