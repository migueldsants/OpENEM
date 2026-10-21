import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../styles.css';
import { Docs } from './Docs';

const raiz = document.getElementById('root')!;
const app = (
  <StrictMode>
    <BrowserRouter>
      <Docs />
    </BrowserRouter>
  </StrictMode>
);

if (raiz.firstElementChild) hydrateRoot(raiz, app);
else createRoot(raiz).render(app);
