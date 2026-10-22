import { ArrowRight, GithubLogo, Plus } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { Wordmark } from '../components/Wordmark';
import { APP_URL, DOCS_URL, GITHUB_URL } from '../config';
import { Arquivo } from './Arquivo';
import { JanelaDoApp } from './JanelaDoApp';
import { QuestaoAoVivo } from './QuestaoAoVivo';
import { ANOS_DO_ENEM, anoDaQuestao, proximaQuestao, QUESTOES } from './questoes';

function BotaoEstudar({ className = '' }: { className?: string }) {
  return (
    <a href={APP_URL} className={`btn btn-primary aperta px-5 py-3.5 text-base ${className}`}>
      Começar a estudar
      <ArrowRight size={18} weight="bold" />
    </a>
  );
}

function Cabecalho() {
  return (
    <header className="mx-auto flex h-[4.5rem] max-w-[1760px] items-center justify-between px-4 sm:px-6 lg:px-14">
      <Wordmark />
      <nav aria-label="Principal" className="flex items-center gap-1 sm:gap-3">
        <a
          href={DOCS_URL}
          className="hidden rounded-lg px-3 py-2 text-[0.95rem] font-medium text-muted hover:text-fg sm:inline-block"
        >
          Documentação
        </a>
        <a
          href={GITHUB_URL}
          className="hidden rounded-lg p-2 text-muted hover:text-fg sm:inline-grid"
          aria-label="Código no GitHub"
        >
          <GithubLogo size={20} />
        </a>
        <a href={APP_URL} className="btn btn-ghost aperta bg-surface">
          Entrar
        </a>
      </nav>
    </header>
  );
}

/**
 * O chão da hero: os 28 anos de ENEM. Os anos com questão de demonstração são
 * botões que trocam a questão do cartão; os outros estão no app.
 */
function FaixaDeAnos({ indice, onEscolher }: { indice: number; onEscolher: (i: number) => void }) {
  const anoAtivo = anoDaQuestao(QUESTOES[indice]);
  return (
    <div className="border-t border-line bg-surface">
      <div className="faixa-anos mx-auto flex max-w-[1760px] flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:gap-6 lg:px-14 xl:gap-8">
        <p className="shrink-0 text-sm leading-snug text-muted lg:w-56">
          Todos os ENEM de 1998 a 2025. Experimente{' '}
          {QUESTOES.map((q, i) => (
            <span key={q.id}>
              <span className="font-data text-fg">{anoDaQuestao(q)}</span>
              {i < QUESTOES.length - 2 ? ', ' : i === QUESTOES.length - 2 ? ' ou ' : '.'}
            </span>
          ))}
        </p>
        <ul
          aria-label="Anos do ENEM"
          className="-mx-4 flex min-w-0 flex-1 gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-[repeat(28,minmax(0,1fr))] lg:overflow-visible lg:px-0"
        >
          {ANOS_DO_ENEM.map((ano) => {
            const i = QUESTOES.findIndex((q) => anoDaQuestao(q) === ano);
            const ativo = ano === anoAtivo;
            const base = 'font-data block shrink-0 rounded-lg px-2 py-2.5 text-center text-[0.82rem] tabular-nums lg:px-0 lg:text-[0.72rem] min-[1400px]:text-[0.82rem]';
            return (
              <li key={ano}>
                {i < 0 ? (
                  <span className={`${base} text-fg/70`}>{ano}</span>
                ) : (
                  <button
                    type="button"
                    aria-pressed={ativo}
                    aria-label={`Questão do ENEM ${ano}`}
                    onClick={() => onEscolher(i)}
                    className={`aperta w-full border ${base} font-medium ${
                      ativo
                        ? 'border-brand bg-brand font-semibold text-brand-ink shadow-[var(--shadow)]'
                        : 'border-fg/25 bg-surface text-fg hover:border-brand hover:text-brand'
                    }`}
                  >
                    {ano}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Hero() {
  const [indice, setIndice] = useState(0);
  return (
    <section aria-labelledby="titulo" className="flex flex-col lg:min-h-[calc(100svh-4.5rem)]">
      <div className="letreiro mx-auto grid w-full max-w-[1760px] flex-1 px-4 pt-6 pb-12 sm:px-6 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_min(34rem,40vw)] lg:content-center lg:gap-x-14 lg:px-14 lg:pt-4 lg:pb-6">
        <h1
          id="titulo"
          className="relative font-display leading-[0.88] font-extrabold tracking-[-0.04em] lg:col-[1/3] lg:row-start-1"
        >
          <span className="block">A prova de verdade.</span>
          <span className="block">De graça.</span>
        </h1>

        <div className="mt-7 lg:col-start-1 lg:row-start-2 lg:mt-12 lg:self-start">
          <p className="max-w-[34ch] text-lg leading-relaxed text-muted sm:text-xl">
            Todas as provas oficiais do ENEM, de 1998 a 2025, com simulados no padrão do INEP e um
            app que mostra onde você está errando.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
            <BotaoEstudar />
            <p className="text-sm font-medium text-muted">Sem anúncio, sem plano pago.</p>
          </div>
        </div>

        {/* No desktop o cartão morde o letreiro: sobe sobre a parte de baixo da
            primeira linha e ocupa o vazio à direita de "De graça.". */}
        <div
          id="questao"
          className="cartao-hero relative z-10 mt-10 scroll-mt-24 lg:col-start-2 lg:row-start-2 lg:self-start"
        >
          <QuestaoAoVivo indice={indice} onOutra={() => setIndice((i) => proximaQuestao(i))} />
        </div>
      </div>
      <FaixaDeAnos indice={indice} onEscolher={setIndice} />
    </section>
  );
}

function Secao({
  id,
  titulo,
  texto,
  children,
  className = '',
}: {
  id: string;
  titulo: string;
  texto?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={`${id}-titulo`} className={`mx-auto max-w-[1760px] px-4 sm:px-6 lg:px-14 ${className}`}>
      <h2
        id={`${id}-titulo`}
        className="max-w-[20ch] font-display text-[2.25rem] leading-[1] font-extrabold tracking-[-0.035em] text-balance sm:text-5xl lg:text-[4rem]"
      >
        {titulo}
      </h2>
      {texto && <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-muted">{texto}</p>}
      <div className="mt-10 sm:mt-14">{children}</div>
    </section>
  );
}

// Capturas reais do app local (ver public/telas). `temas` marca as que têm
// versão clara e escura; `celular` as que têm uma captura de celular, servida
// em tela estreita (a de desktop encolhida ficava ilegível). Caderno e lousa
// têm cores fixas.
interface ImagemDoBento {
  src: string;
  alt: string;
  w: number;
  h: number;
  temas?: boolean;
  celular?: boolean;
}

const SIMULADO: { titulo: string; texto: string; img: ImagemDoBento }[] = [
  {
    titulo: 'Simulado no padrão do ENEM',
    texto: 'Por prova ou por tema, com o tempo da prova e a correção na hora.',
    img: {
      src: '/telas/simulado',
      alt: 'Simulado do ENEM 2023, 2º dia, em andamento no OpENEM, com o cronômetro e a primeira questão.',
      w: 1600,
      h: 1000,
      temas: true,
      celular: true,
    },
  },
  {
    titulo: 'Caderno em PDF',
    texto: 'Duas colunas, cartão-resposta e gabarito, prontos para imprimir.',
    img: {
      src: '/telas/caderno.webp',
      alt: 'Página do caderno em PDF do ENEM 2024, 2º dia, gerado pelo OpENEM, em duas colunas.',
      w: 900,
      h: 1273,
    },
  },
  {
    titulo: 'Quadro da sala',
    texto: 'Fazendo no papel? A lousa marca o tempo que falta, como o fiscal faz na sala.',
    img: {
      src: '/telas/quadro.webp',
      alt: 'Lousa do OpENEM com o horário de início, de término e o tempo restante.',
      w: 1600,
      h: 1000,
    },
  },
  {
    titulo: 'Do seu jeito',
    texto: 'Área, matéria e assunto se somam no mesmo simulado, e o recorte fica salvo para repetir.',
    img: {
      src: '/telas/recorte',
      alt: 'Cartão Monte o seu por tema do OpENEM, com as áreas, a matéria e a quantidade de questões.',
      w: 716,
      h: 1198,
      temas: true,
    },
  },
];

/** Imagem de um bloco da grade: lados claro/escuro e, quando há, a versão de celular. */
function ImagemDoBloco({ img, className }: { img: ImagemDoBento; className: string }) {
  const lados = img.temas
    ? (['clara', 'escura'] as const).map((lado) => ({
        src: `${img.src}-${lado}.webp`,
        celular: img.celular ? `${img.src}-celular-${lado}.webp` : null,
        cls: lado === 'clara' ? 'tela-clara' : 'tela-escura',
      }))
    : [{ src: img.src, celular: null, cls: '' }];
  return (
    <>
      {lados.map(({ src, celular, cls }) => (
        <picture key={src} className={cls}>
          {celular && <source media="(max-width: 767px)" srcSet={celular} />}
          <img
            src={src}
            alt={img.alt}
            width={img.w}
            height={img.h}
            loading="lazy"
            decoding="async"
            className={`w-full border border-line object-cover object-top ${className}`}
          />
        </picture>
      ))}
    </>
  );
}

const JEITOS: { titulo: string; texto: string }[] = [
  {
    titulo: 'No celular ou no computador',
    texto: 'Instala direto do navegador, sem loja, e a conta é a mesma nos dois.',
  },
  {
    titulo: 'Sem internet, em parte',
    texto: 'As questões que você já abriu ficam no aparelho, e as respostas sobem quando a conexão volta.',
  },
  {
    titulo: 'Temas customizáveis',
    texto: 'Claro, escuro, OLED e alto contraste, ou um tema com as suas cores.',
  },
  {
    titulo: 'Gamificação se você quiser',
    texto: 'XP, ligas e dias seguidos para quem gosta; um botão no perfil desliga tudo.',
  },
];

const PERGUNTAS: { p: string; r: string }[] = [
  {
    p: 'É grátis mesmo?',
    r: 'Sim. Não existe plano pago nem anúncio. O OpENEM é software livre, com o código aberto no GitHub.',
  },
  {
    p: 'Preciso criar conta?',
    r: 'Sim, com e-mail e senha. É a conta que guarda suas respostas, a sua revisão e o seu progresso.',
  },
  {
    p: 'De onde vêm as questões?',
    r: 'Das provas oficiais do ENEM aplicadas pelo INEP, de 1998 a 2025, incluindo reaplicações e outras aplicações. O texto é reproduzido como saiu no caderno.',
  },
  {
    p: 'Funciona sem internet?',
    r: 'Em parte. As questões que você já abriu ficam no aparelho, e as respostas dadas sem internet são enviadas quando a conexão volta. Avaliar flashcards e entregar um simulado precisam de conexão.',
  },
];

export function Landing() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <Cabecalho />

      <main id="conteudo">
        <Hero />

        <Secao
          id="depois"
          titulo="Respondeu? O app cuida do resto."
          texto="Cada resposta alimenta a sua revisão, as questões recomendadas e o seu desempenho. São estas as telas, do app de verdade."
          className="pt-24 sm:pt-32 lg:pt-40"
        >
          <JanelaDoApp />
        </Secao>

        <Secao id="simulado" titulo="No fim de semana, a prova inteira." className="pt-28 sm:pt-36 lg:pt-44">
          <div className="grid gap-4 md:grid-cols-6 md:grid-rows-[auto_auto] lg:gap-5">
            {SIMULADO.map((s, i) => (
              <article
                key={s.titulo}
                className={`card flex flex-col overflow-hidden ${
                  i === 0
                    ? 'md:col-span-4'
                    : i === 1
                      ? 'md:col-span-2 md:row-span-2'
                      : i === 2
                        ? 'md:col-span-2'
                        : 'md:col-span-2'
                }`}
              >
                <div className="p-5 sm:p-7">
                  <h3 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{s.titulo}</h3>
                  <p className="mt-2 max-w-[42ch] leading-relaxed text-muted">{s.texto}</p>
                </div>
                <div
                  className={`px-5 sm:px-7 ${
                    // O caderno ocupa a altura do bloco (duas linhas da grade).
                    i === 1 ? 'min-h-0 flex-1 pb-5 sm:pb-7 md:[&_img]:h-full md:[&_picture]:block md:[&_picture]:h-full' : 'mt-auto'
                  }`}
                >
                  <ImagemDoBloco
                    img={s.img}
                    className={
                      i === 0
                        ? 'aspect-[4/5] rounded-t-xl border-b-0 md:aspect-[16/9]'
                        : i === 1
                          ? 'rounded-xl md:object-left-top'
                          : 'aspect-[16/9] rounded-t-xl border-b-0'
                    }
                  />
                </div>
              </article>
            ))}
          </div>
        </Secao>

        <Secao
          id="arquivo"
          titulo="Todos os temas de redação, desde 1998."
          texto="Escolha um ano para ver o tema da redação daquela prova. A proposta completa, com os textos motivadores, está no app."
          className="pt-28 sm:pt-36 lg:pt-44"
        >
          <Arquivo />
        </Secao>

        <Secao id="jeito" titulo="Do jeito que você estuda." className="pt-28 sm:pt-36 lg:pt-44">
          <dl className="grid border-t border-line md:grid-cols-2 md:gap-x-14">
            {JEITOS.map(({ titulo, texto }) => (
              <div key={titulo} className="grid gap-1.5 border-b border-line py-6 sm:py-7">
                <dt className="font-display text-lg font-bold tracking-tight">{titulo}</dt>
                <dd className="max-w-[44ch] leading-relaxed text-muted">{texto}</dd>
              </div>
            ))}
          </dl>
        </Secao>

        <section aria-labelledby="livre-titulo" className="mt-28 border-y border-line bg-surface sm:mt-36 lg:mt-44">
          <div className="mx-auto grid max-w-[1760px] gap-8 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-14 lg:px-14 lg:py-28">
            <h2
              id="livre-titulo"
              className="max-w-[14ch] font-display text-[2.25rem] leading-[1] font-extrabold tracking-[-0.035em] text-balance sm:text-5xl lg:text-[4rem]"
            >
              Ninguém cobra. O&nbsp;código é aberto.
            </h2>
            <div>
              <p className="max-w-[52ch] text-lg leading-relaxed text-muted">
                Sem anúncio e sem plano pago. O OpENEM é software livre (AGPL-3.0): o código está no
                GitHub, e qualquer escola ou cursinho pode rodar a própria cópia.
              </p>
              <a
                href={GITHUB_URL}
                className="mt-7 inline-flex items-center gap-2 font-semibold text-fg underline decoration-brand decoration-2 underline-offset-[6px] hover:text-brand"
              >
                <GithubLogo size={20} />
                Ver o código no GitHub
              </a>
            </div>
          </div>
        </section>

        <Secao id="perguntas" titulo="Perguntas frequentes" className="pt-28 sm:pt-36 lg:pt-44">
          <div className="faq max-w-4xl divide-y divide-line border-y border-line">
            {PERGUNTAS.map(({ p, r }) => (
              <details key={p} className="group">
                <summary className="flex items-center justify-between gap-4 py-6 text-lg font-semibold sm:text-xl">
                  {p}
                  <Plus size={20} className="seta shrink-0 text-muted" />
                </summary>
                <p className="max-w-[62ch] pb-7 text-lg leading-relaxed text-muted">{r}</p>
              </details>
            ))}
          </div>
        </Secao>

        <section
          aria-labelledby="fim-titulo"
          className="mx-auto max-w-[1760px] px-4 pt-28 pb-24 sm:px-6 sm:pt-36 sm:pb-32 lg:px-14 lg:pt-48 lg:pb-40"
        >
          <h2
            id="fim-titulo"
            className="letreiro-fim font-display leading-[0.9] font-extrabold tracking-[-0.04em] text-balance"
          >
            A próxima questão é sua.
          </h2>
          <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2">
            <BotaoEstudar />
            <p className="text-sm font-medium text-muted">Grátis, sem anúncio.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1760px] flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-14">
          <div>
            <Wordmark />
            <p className="mt-1 text-sm text-muted">Preparação gratuita e de código aberto para o ENEM.</p>
          </div>
          <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href={DOCS_URL} className="text-muted hover:text-fg">
              Documentação
            </a>
            <a href={GITHUB_URL} className="text-muted hover:text-fg">
              GitHub
            </a>
            <a href={`${GITHUB_URL}/blob/main/LICENSE`} className="text-muted hover:text-fg">
              Licença AGPL-3.0
            </a>
            <a href={`${GITHUB_URL}/blob/main/SECURITY.md`} className="text-muted hover:text-fg">
              Segurança
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
