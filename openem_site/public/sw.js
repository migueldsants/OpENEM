// Desliga o service worker antigo do app (issue #88).
//
// Até o app ir para /app/, ele morava na raiz, com um service worker em /sw.js
// de escopo "/" que respondia a toda navegação da origem com o app em cache.
// Quem já tinha instalado continuaria vendo o app no lugar da landing e da
// documentação. O navegador procura atualização do service worker no mesmo
// caminho a cada navegação: encontra este arquivo, instala, e ele se desregistra,
// apaga o cache do app antigo e recarrega as abas, que passam a vir da rede.
//
// O app novo tem o próprio service worker em /app/sw.js, e o cache dele (cujo
// nome leva o escopo /app/) não é apagado aqui.

// Os endereços do app antigo, os mesmos que o nginx redireciona para /app/
// (sw-antigo.test.ts confere). O navegador pode ter guardado no cache HTTP a
// página antiga de cada um (sem Cache-Control, ele estima um prazo sozinho):
// sem renovar, /questoes abriria o app velho, cujos arquivos não existem mais.
const ENDERECOS_ANTIGOS = [
  '/',
  '/login',
  '/onboarding',
  '/painel',
  '/questoes',
  '/simulados',
  '/desempenho',
  '/revisao',
  '/progresso',
  '/conquistas',
  '/cronograma',
  '/pomodoro',
  '/cronometros',
  '/ferramentas',
  '/redacoes',
  '/comunidade',
  '/perfil',
  '/temas',
  '/favoritos',
  '/flashcards',
  '/formulas',
  '/videos',
  '/quadro',
];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes
          .filter((nome) => nome.startsWith('workbox-precache') && !nome.includes('/app/'))
          .map((nome) => caches.delete(nome)),
      );
      // cache: 'reload' busca na rede e grava a resposta nova (o 301) no cache
      // HTTP no lugar da antiga. Falha de rede aqui não impede o resto.
      await Promise.all(
        ENDERECOS_ANTIGOS.map((url) =>
          fetch(url, { cache: 'reload', redirect: 'manual' }).catch(() => undefined),
        ),
      );
      await self.registration.unregister();
      const abas = await self.clients.matchAll({ type: 'window' });
      for (const aba of abas) aba.navigate(aba.url);
    })(),
  );
});
