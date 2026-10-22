import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import '../styles.css';
import { Landing } from './Landing';

const raiz = document.getElementById('root')!;
const app = (
  <StrictMode>
    <Landing />
  </StrictMode>
);

// No build a página chega pré-renderizada (scripts/prerender.mjs); no dev, não.
if (raiz.firstElementChild) hydrateRoot(raiz, app);
else createRoot(raiz).render(app);
