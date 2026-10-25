import { GithubLogo, Globe } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { Wordmark } from '../components/Wordmark';
import { APP_URL, DOCS_URL, GITHUB_URL } from '../config';
import { titulosDaPagina } from '../docs/conteudo';
import { langDo, type Idioma } from '../docs/i18n';
import { Markdown } from '../docs/Markdown';
import { dataPorExtenso, documentoPorUrl, lerUrl, SLUGS, TEXTOS_LEGAIS, urlDoDocumento } from './documentos';

/** Política de Privacidade ou Termos de Uso, pela URL (pré-renderizada no build). */
export function Legal({ url }: { url: string }) {
  const documento = documentoPorUrl(url);
  const idioma: Idioma = lerUrl(url)?.idioma ?? 'pt';
  const t = TEXTOS_LEGAIS[idioma];
  const outro: Idioma = idioma === 'en' ? 'pt' : 'en';
  const docs = idioma === 'en' ? `${DOCS_URL}en/` : DOCS_URL;

  useEffect(() => {
    if (documento) document.title = `${documento.titulo} | OpENEM`;
    document.documentElement.lang = langDo(idioma);
  }, [documento, idioma]);

  if (!documento) return null;
  const titulos = titulosDaPagina(documento.corpo);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
      >
        {t.pular}
      </a>
      <header className="filterbar border-b border-line">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between gap-3 px-4 sm:px-6">
          <Wordmark />
          <nav aria-label={t.rodape} className="flex items-center gap-1 sm:gap-3">
            <a
              href={urlDoDocumento(documento.slug, outro)}
              hrefLang={langDo(outro)}
              lang={langDo(outro)}
              // No celular só o ícone aparece: o nome vem daqui.
              aria-label={t.outroIdioma}
              className="inline-flex items-center gap-1.5 rounded-lg p-2 text-sm text-muted hover:text-fg"
            >
              <Globe size={18} />
              <span className="hidden sm:inline">{t.outroIdioma}</span>
            </a>
            <a href={APP_URL} className="btn btn-primary aperta">
              {t.abrirApp}
            </a>
          </nav>
        </div>
      </header>

      <main id="conteudo" className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6 lg:py-14">
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_14rem] xl:gap-12">
          <article className="min-w-0 max-w-[72ch]">
            <p className="text-sm text-muted">
              {t.atualizado}: <time dateTime={documento.atualizado}>{dataPorExtenso(documento.atualizado, idioma)}</time>
            </p>
            <h1 className="mt-3 font-display text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] text-balance sm:text-[2.75rem]">
              {documento.titulo}
            </h1>
            {documento.descricao && <p className="mt-4 text-lg leading-relaxed text-muted">{documento.descricao}</p>}
            <div className="mt-8 text-[1.02rem] text-fg">
              <Markdown>{documento.corpo}</Markdown>
            </div>
          </article>
          {titulos.length > 1 && (
            <aside className="hidden xl:block">
              <div className="sticky top-8">
                <ul className="space-y-2 border-l border-line text-sm">
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
      </main>

      <footer className="border-t border-line">
        <nav
          aria-label={t.rodape}
          className="mx-auto flex max-w-[1100px] flex-wrap gap-x-6 gap-y-2 px-4 pt-8 pb-12 text-[0.95rem] sm:px-6"
        >
          <a href="/" className="text-muted hover:text-fg">
            {t.inicio}
          </a>
          {SLUGS.map((slug) => (
            <a
              key={slug}
              href={urlDoDocumento(slug, idioma)}
              aria-current={slug === documento.slug ? 'page' : undefined}
              className="text-muted hover:text-fg aria-[current=page]:font-semibold aria-[current=page]:text-fg"
            >
              {slug === 'privacidade' ? t.privacidade : t.termos}
            </a>
          ))}
          <a href={docs} className="text-muted hover:text-fg">
            {t.documentacao}
          </a>
          <a href={GITHUB_URL} className="inline-flex items-center gap-1.5 text-muted hover:text-fg">
            <GithubLogo size={16} />
            {t.codigo}
          </a>
        </nav>
      </footer>
    </div>
  );
}
