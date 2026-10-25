import { ArrowLeft, ArrowRight, GithubLogo, Globe, List, PencilSimple, X } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Wordmark } from '../components/Wordmark';
import { APP_URL, GITHUB_URL } from '../config';
import { Busca } from './Busca';
import { gruposDo, paginaPorUrl, paginasDo, titulosDaPagina, type Pagina } from './conteudo';
import { baseDo, idiomaDaUrl, langDo, TEXTOS, urlNoIdioma, type Idioma } from './i18n';
import { Markdown } from './Markdown';

function useIdioma(): Idioma {
  return idiomaDaUrl(useLocation().pathname);
}

function Navegacao({ aoEscolher }: { aoEscolher?: () => void }) {
  const idioma = useIdioma();
  const paginas = paginasDo(idioma);
  return (
    <nav aria-label={TEXTOS[idioma].paginas} className="flex flex-col gap-6">
      {gruposDo(idioma).map((g) => {
        const doGrupo = paginas.filter((p) => p.grupo === g.id);
        if (doGrupo.length === 0) return null;
        return (
          <div key={g.id}>
            <p className="eyebrow px-3 pb-1.5">{g.titulo}</p>
            <ul className="flex flex-col gap-0.5">
              {doGrupo.map((p) => (
                <li key={p.url}>
                  <NavLink
                    to={p.url}
                    onClick={aoEscolher}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        isActive ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`h-4 w-0.5 shrink-0 rounded-full ${isActive ? 'bg-brand' : 'bg-transparent'}`}
                        />
                        {p.titulo}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/** Política de Privacidade e Termos de Uso, no idioma da página. */
function LinksLegais({ className = '' }: { className?: string }) {
  const idioma = useIdioma();
  const t = TEXTOS[idioma];
  const prefixo = idioma === 'en' ? '/en' : '';
  return (
    <nav aria-label={t.legais} className={`flex gap-4 text-xs text-muted ${className}`}>
      <a href={`${prefixo}/privacidade/`} className="hover:text-fg">
        {t.privacidade}
      </a>
      <a href={`${prefixo}/termos/`} className="hover:text-fg">
        {t.termos}
      </a>
    </nav>
  );
}

/** Link para o mesmo endereço no outro idioma. */
function TrocaDeIdioma({ aoEscolher, className = '' }: { aoEscolher?: () => void; className?: string }) {
  const { pathname } = useLocation();
  const idioma = idiomaDaUrl(pathname);
  const outro: Idioma = idioma === 'en' ? 'pt' : 'en';
  return (
    <Link
      to={urlNoIdioma(pathname, outro)}
      onClick={aoEscolher}
      hrefLang={langDo(outro)}
      lang={langDo(outro)}
      className={`inline-flex items-center gap-1.5 rounded-lg p-2 text-sm text-muted hover:text-fg ${className}`}
    >
      <Globe size={18} />
      {TEXTOS[idioma].outroIdioma}
    </Link>
  );
}

function Inicio() {
  const idioma = useIdioma();
  const t = TEXTOS[idioma];
  const paginas = paginasDo(idioma);
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] text-balance sm:text-5xl">
        {t.inicioTitulo}
      </h1>
      <p className="mt-4 max-w-[58ch] text-lg leading-relaxed text-muted">{t.inicioResumo}</p>
      <div className="mt-12 grid gap-10">
        {gruposDo(idioma).map((g) => {
          const doGrupo = paginas.filter((p) => p.grupo === g.id);
          if (doGrupo.length === 0) return null;
          return (
            <section key={g.id} aria-labelledby={`grupo-${g.id}`}>
              <h2 id={`grupo-${g.id}`} className="font-display text-2xl font-bold tracking-tight">
                {g.titulo}
              </h2>
              <p className="mt-1 text-muted">{g.resumo}</p>
              <ul className="mt-5 grid gap-x-8 sm:grid-cols-2">
                {doGrupo.map((p) => (
                  <li key={p.url} className="border-t border-line">
                    <Link to={p.url} className="group block py-3.5">
                      <span className="flex items-center justify-between gap-3 font-semibold group-hover:text-brand">
                        <span lang={p.traduzida ? undefined : 'pt-BR'}>{p.titulo}</span>
                        <ArrowRight
                          size={16}
                          className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
                        />
                      </span>
                      {p.descricao && (
                        <span
                          lang={p.traduzida ? undefined : 'pt-BR'}
                          className="mt-1 block text-sm leading-relaxed text-muted"
                        >
                          {p.descricao}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Vizinhas({ pagina }: { pagina: Pagina }) {
  const t = TEXTOS[pagina.idioma];
  const paginas = paginasDo(pagina.idioma);
  const i = paginas.indexOf(pagina);
  const anterior = paginas[i - 1];
  const proxima = paginas[i + 1];
  return (
    <nav aria-label={t.vizinhas} className="mt-14 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
      {anterior ? (
        <Link to={anterior.url} className="card lift block p-4">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <ArrowLeft size={14} /> {t.anterior}
          </span>
          <span className="mt-1 block font-semibold">{anterior.titulo}</span>
        </Link>
      ) : (
        <span />
      )}
      {proxima && (
        <Link to={proxima.url} className="card lift block p-4 text-right">
          <span className="flex items-center justify-end gap-1.5 text-xs text-muted">
            {t.proxima} <ArrowRight size={14} />
          </span>
          <span className="mt-1 block font-semibold">{proxima.titulo}</span>
        </Link>
      )}
    </nav>
  );
}

function PaginaDoc() {
  const idioma = useIdioma();
  const t = TEXTOS[idioma];
  const { grupo, slug } = useParams();
  const pagina = paginaPorUrl(`${baseDo(idioma)}${grupo}/${slug}/`);
  if (!pagina) return <NaoEncontrada />;
  const titulos = titulosDaPagina(pagina.corpo);
  const nomeGrupo = gruposDo(idioma).find((g) => g.id === pagina.grupo)?.titulo;
  // Sem tradução, o texto da página é português: o leitor de tela precisa saber.
  const langDoTexto = pagina.traduzida ? undefined : 'pt-BR';

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_13rem] xl:gap-12">
      <article className="min-w-0 max-w-[72ch]">
        <p className="text-sm text-muted">
          <Link to={baseDo(idioma)} className="hover:text-fg">
            {t.documentacao}
          </Link>
          <span aria-hidden="true"> / </span>
          {nomeGrupo}
        </p>
        {!pagina.traduzida && (
          <p role="note" className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
            {t.semTraducao}
          </p>
        )}
        <div lang={langDoTexto}>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] text-balance sm:text-[2.75rem]">
            {pagina.titulo}
          </h1>
          {pagina.descricao && <p className="mt-4 text-lg leading-relaxed text-muted">{pagina.descricao}</p>}
          <div className="mt-8 text-[1.02rem] text-fg">
            <Markdown>{pagina.corpo}</Markdown>
          </div>
        </div>
        {pagina.arquivo && (
          <a
            href={`${GITHUB_URL}/edit/main/${pagina.arquivo}`}
            className="mt-10 inline-flex items-center gap-2 text-sm text-muted hover:text-fg"
          >
            <PencilSimple size={16} />
            {t.sugerir}
          </a>
        )}
        <Vizinhas pagina={pagina} />
      </article>
      {titulos.length > 1 && (
        <aside className="hidden xl:block">
          <div className="sticky top-8">
            <p className="text-sm font-semibold">{t.nestaPagina}</p>
            <ul lang={langDoTexto} className="mt-3 space-y-2 border-l border-line text-sm">
              {titulos.map((h) => (
                <li key={h.id}>
                  <a
                    href={`#${h.id}`}
                    className="-ml-px block border-l border-transparent pl-3 text-muted hover:border-brand hover:text-fg"
                  >
                    {h.texto}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}

function NaoEncontrada() {
  const idioma = useIdioma();
  const t = TEXTOS[idioma];
  return (
    <div className="max-w-xl">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">{t.naoEncontradaTitulo}</h1>
      <p className="mt-4 text-muted">{t.naoEncontradaTexto}</p>
      <Link to={baseDo(idioma)} className="btn btn-primary aperta mt-6">
        {t.irAoInicio}
      </Link>
    </div>
  );
}

/** Título da aba, idioma do documento e rolagem ao topo a cada troca de página. */
function useTrocaDePagina() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const idioma = idiomaDaUrl(pathname);
    const base = TEXTOS[idioma].tituloBase;
    const pagina = paginaPorUrl(pathname);
    document.title = pagina ? `${pagina.titulo} | ${base}` : base;
    document.documentElement.lang = langDo(idioma);
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
}

export function Docs() {
  const [menu, setMenu] = useState(false);
  const idioma = useIdioma();
  const t = TEXTOS[idioma];
  useTrocaDePagina();

  return (
    <div className="min-h-dvh bg-bg text-fg lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
      >
        {t.pular}
      </a>

      <aside className="hidden lg:block">
        <div className="sticky top-0 flex h-dvh flex-col border-r border-line bg-sidebar px-4 py-5">
          <div className="flex items-baseline gap-2 px-2">
            <Wordmark />
            <span className="text-sm font-medium text-muted">docs</span>
          </div>
          <div className="mt-6">
            <Busca />
          </div>
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto pb-6 [scrollbar-width:thin]">
            <Navegacao />
          </div>
          <div className="border-t border-line pt-3">
            <TrocaDeIdioma className="-ml-2 mb-2" />
            <div className="flex items-center justify-between gap-2">
              <a href={APP_URL} className="btn btn-primary aperta">
                {t.abrirApp}
              </a>
              <a href={GITHUB_URL} aria-label={t.codigo} className="rounded-lg p-2 text-muted hover:text-fg">
                <GithubLogo size={20} />
              </a>
            </div>
            <LinksLegais className="mt-3" />
          </div>
        </div>
      </aside>

      {/* Celular: barra no topo e o índice num painel. */}
      <header className="filterbar border-b border-line lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-baseline gap-2">
            <Wordmark />
            <span className="text-sm font-medium text-muted">docs</span>
          </div>
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-controls="menu-docs"
            className="btn btn-ghost aperta"
          >
            {menu ? <X size={18} /> : <List size={18} />}
            {menu ? t.fechar : t.indice}
          </button>
        </div>
        {menu && (
          <div id="menu-docs" className="animate-fade max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-line px-4 pt-4 pb-8">
            <Busca aoEscolher={() => setMenu(false)} />
            <div className="mt-6">
              <Navegacao aoEscolher={() => setMenu(false)} />
            </div>
            <a href={APP_URL} className="btn btn-primary aperta mt-8 w-full">
              {t.abrirApp}
            </a>
            <TrocaDeIdioma aoEscolher={() => setMenu(false)} className="mt-3" />
            <LinksLegais className="mt-4 px-2" />
          </div>
        )}
      </header>

      <main id="conteudo" className="min-w-0 px-4 py-10 sm:px-8 lg:px-12 lg:py-14 xl:px-16">
        <Routes>
          <Route path="/docs/" element={<Inicio />} />
          <Route path="/docs/en/" element={<Inicio />} />
          <Route path="/docs/en/:grupo/:slug/" element={<PaginaDoc />} />
          <Route path="/docs/:grupo/:slug/" element={<PaginaDoc />} />
          <Route path="*" element={<NaoEncontrada />} />
        </Routes>
      </main>
    </div>
  );
}
