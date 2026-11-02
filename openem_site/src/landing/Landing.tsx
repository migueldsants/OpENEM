import {
  ArrowRight,
  Cards,
  ChartBar,
  ChatsCircle,
  Flame,
  GithubLogo,
  Heart,
  Palette,
  Timer,
  type Icon,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import temas from 'virtual:arquivo-redacoes';
import { Wordmark } from '../components/Wordmark';
import { APP_URL, DOCS_URL, GITHUB_URL, SPONSOR_URL } from '../config';
import { Caderno } from './Caderno';
import { ANOS_DO_ENEM } from './prova';
import { useAoAparecer, useRevelar } from './revelar';
import { TabelaPrevia } from './TabelaPrevia';

/** Questões oficiais no banco (1998 a 2025, todas as aplicações). */
const QUESTOES_OFICIAIS = 7781;

/** Posição de um item na entrada em sequência (ver `.rv-*` em styles.css). */
const ordem = (i: number, extra?: Record<string, string | number>) => ({ '--i': i, ...extra }) as CSSProperties;

function lerSessao(): boolean {
  try {
    return !!localStorage.getItem('openem.token');
  } catch {
    // localStorage bloqueado (modo privado, cookies de terceiros): sem sessão.
    return false;
  }
}

const semAssinatura = () => () => {};

/**
 * Se quem visita já entrou no app (o token fica no localStorage, que é da
 * mesma origem). No servidor é sempre false, como no HTML pré-renderizado:
 * sem JavaScript, o botão continua "Começar a estudar".
 */
function useTemSessao(): boolean {
  return useSyncExternalStore(semAssinatura, lerSessao, () => false);
}

function BotaoEstudar({ className = '' }: { className?: string }) {
  const temSessao = useTemSessao();
  return (
    <a href={APP_URL} className={`btn btn-primary aperta px-6 py-3.5 text-base ${className}`}>
      {temSessao ? 'Continuar estudando' : 'Começar a estudar'}
      <ArrowRight size={18} weight="bold" />
    </a>
  );
}

const TITULO_H2 =
  'font-display text-[2.15rem] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance sm:text-5xl lg:text-[3.25rem]';

function Cabecalho() {
  return (
    <header className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
      <Wordmark />
      <nav aria-label="Seções" className="hidden gap-5 text-[0.95rem] font-medium md:flex lg:gap-7">
        <a href="#recursos" className="text-muted hover:text-fg">
          Recursos
        </a>
        <a href="#tabela" className="text-muted hover:text-fg">
          Tabela periódica
        </a>
        <a href="#redacoes" className="text-muted hover:text-fg">
          Redações
        </a>
        {/* Entre md e lg só cabem três âncoras sem quebrar a barra. */}
        <a href="#papel" className="hidden text-muted hover:text-fg lg:inline">
          No papel
        </a>
        <a href="#aberto" className="hidden text-muted hover:text-fg lg:inline">
          Hospedar
        </a>
      </nav>
      <div className="flex items-center gap-2">
        <a href={GITHUB_URL} className="btn btn-ghost aperta min-h-11 bg-surface" aria-label="Código no GitHub">
          <GithubLogo size={18} />
          <span className="hidden sm:inline">GitHub</span>
        </a>
        <a href={APP_URL} className="btn btn-primary aperta min-h-11">
          Abrir o app
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section
      aria-labelledby="titulo"
      className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 pt-8 pb-16 sm:px-6 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-14 lg:pb-20"
    >
      <div className="flex flex-col gap-7">
        <div className="flex flex-wrap gap-2">
          <span className="chip bg-surface text-[0.8rem] font-semibold text-muted">
            <span className="size-2 rounded-full bg-nat" aria-hidden="true" />
            Gratuito
          </span>
          <span className="chip bg-surface text-[0.8rem] font-semibold text-muted">Código aberto · AGPL-3.0</span>
        </div>
        <h1
          id="titulo"
          className="font-display text-[2.7rem] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl lg:text-[4.6rem]"
        >
          Treine com as questões que já caíram no ENEM.
        </h1>
        <p className="max-w-[34em] text-lg leading-relaxed text-muted sm:text-[1.2rem]">
          Todas as provas oficiais de 1998 a 2025, simulados no tempo da prova, os temas de redação de
          todos os anos e revisão do que você errou. Sem anúncio e sem plano pago.
        </p>
        <div className="flex flex-wrap gap-3">
          <BotaoEstudar />
          <a href="#aberto" className="btn btn-ghost aperta bg-surface px-5 py-3.5 text-base">
            Hospedar o seu
          </a>
        </div>
      </div>
      <Caderno />
    </section>
  );
}

const DURACAO_CONTAGEM_MS = 1200;

/**
 * Um número da faixa que conta do zero quando aparece. O HTML pré-renderizado
 * e o movimento reduzido já mostram o valor final; o leitor de tela lê sempre
 * o valor final, nunca a contagem.
 */
function Contador({ ate, depois = '' }: { ate: number; depois?: string }) {
  const ref = useRef<HTMLElement>(null);
  const { espera, apareceu } = useAoAparecer(ref);
  const [atual, setAtual] = useState(0);
  useEffect(() => {
    if (!apareceu) return;
    let quadro = 0;
    const inicio = performance.now();
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / DURACAO_CONTAGEM_MS);
      // Desacelera no fim (expo-out): os últimos algarismos assentam devagar.
      setAtual(t === 1 ? ate : Math.round(ate * (1 - 2 ** (-10 * t))));
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [apareceu, ate]);
  const mostrado = espera || apareceu ? atual : ate;
  return (
    <dd
      ref={ref}
      className="font-display text-[2.1rem] leading-tight font-extrabold tracking-[-0.03em] tabular-nums sm:text-[2.75rem]"
    >
      <span aria-hidden="true">
        {mostrado.toLocaleString('pt-BR')}
        {depois}
      </span>
      <span className="sr-only">
        {ate.toLocaleString('pt-BR')}
        {depois}
      </span>
    </dd>
  );
}

function Numeros() {
  const itens: { valor: number; depois?: string; texto: string }[] = [
    { valor: QUESTOES_OFICIAIS, texto: 'questões oficiais, com gabarito' },
    {
      valor: ANOS_DO_ENEM.length,
      depois: ' anos',
      texto: `de provas, de ${ANOS_DO_ENEM[0]} a ${ANOS_DO_ENEM[ANOS_DO_ENEM.length - 1]}`,
    },
    { valor: temas.length, depois: ' temas', texto: 'de redação, com a página do caderno' },
  ];
  return (
    <section aria-label="O OpENEM em números" className="border-y border-line bg-surface">
      <dl className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-6 gap-y-8 px-4 py-9 sm:px-6 lg:grid-cols-4">
        {itens.map(({ valor, depois, texto }) => (
          <div key={texto} className="flex flex-col-reverse">
            <dt className="text-[0.95rem] text-muted">{texto}</dt>
            <Contador ate={valor} depois={depois} />
          </div>
        ))}
        <div className="flex flex-col-reverse">
          <dt className="text-[0.95rem] text-muted">para estudar, sem limite de questões</dt>
          <dd className="font-display text-[2.1rem] leading-tight font-extrabold tracking-[-0.03em] sm:text-[2.75rem]">
            R$ 0
          </dd>
        </div>
      </dl>
    </section>
  );
}

const PASSOS: { titulo: string; texto: string }[] = [
  {
    titulo: 'Pratique',
    texto:
      'Questões oficiais filtradas por área, matéria, assunto e ano. Responda, veja o gabarito na hora e guarde nos favoritos as que quer rever.',
  },
  {
    titulo: 'Simule',
    texto:
      'A prova inteira no tempo de verdade, ou um recorte só seu: some áreas, matérias e assuntos, escolha os anos e veja quantas questões cabem antes de começar.',
  },
  {
    titulo: 'Revise',
    texto:
      'O que você erra volta no intervalo certo, por repetição espaçada. O que você acerta vai ficando cada vez mais longe.',
  },
];

const RECURSOS: { icone: Icon; cor: string; titulo: string; texto: string }[] = [
  {
    icone: ChartBar,
    cor: 'text-mat',
    titulo: 'Desempenho semana a semana',
    texto:
      'Minutos de foco, questões e acerto por área contra a sua meta, e as três prioridades do mês com um botão para praticar.',
  },
  {
    icone: Cards,
    cor: 'text-nat',
    titulo: 'Flashcards e fórmulas',
    texto: 'Decks prontos por matéria e um caderno de fórmulas em PDF, montado só com as que você escolher.',
  },
  {
    icone: Flame,
    cor: 'text-hum',
    titulo: 'Sequência, XP e ligas',
    texto: 'Dias seguidos, desafio diário e ligas do Bronze ao Diamante. Não curte? Um botão no perfil desliga tudo.',
  },
  {
    icone: ChatsCircle,
    cor: 'text-lin',
    titulo: 'Comunidade',
    texto: 'Um fórum para tirar dúvida e discutir questão com quem está estudando para a mesma prova.',
  },
  {
    icone: Timer,
    cor: 'text-red',
    titulo: 'Cronograma e cronômetros',
    texto: 'Monte a sua semana bloco a bloco, use o Pomodoro para o foco e quantos timers precisar ao mesmo tempo.',
  },
  {
    icone: Palette,
    cor: 'text-fg',
    titulo: 'Temas customizáveis',
    texto: 'Claro, escuro, OLED, alto contraste ou com as suas cores. Estude do jeito que cansa menos o olho.',
  },
];

const AREAS: { nome: string; cor: string }[] = [
  { nome: 'Matemática', cor: 'text-mat bg-mat/10' },
  { nome: 'Ciências da Natureza', cor: 'text-nat bg-nat/10' },
  { nome: 'Ciências Humanas', cor: 'text-hum bg-hum/10' },
  { nome: 'Linguagens', cor: 'text-lin bg-lin/10' },
  { nome: 'Redação', cor: 'text-red bg-red/10' },
];

function Recursos() {
  return (
    <section aria-labelledby="recursos-titulo" id="recursos" className="mx-auto max-w-[1200px] px-4 pt-24 sm:px-6 sm:pt-28">
      <h2 id="recursos-titulo" data-revela className={`rv-sobe max-w-[760px] ${TITULO_H2}`}>
        Pratique, simule, revise. E repita até a prova.
      </h2>
      <ol data-revela className="mt-14 grid gap-10 md:grid-cols-3">
        {PASSOS.map(({ titulo, texto }, i) => (
          <li key={titulo} className="relative flex flex-col gap-3 pt-5" style={ordem(i)}>
            <span aria-hidden="true" className="rv-traco absolute inset-x-0 top-0 h-0.5 rounded-full bg-fg" />
            <span className="rv-sobe font-data text-sm text-muted" style={ordem(i * 2)}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="rv-sobe font-display text-[1.75rem] font-bold tracking-tight" style={ordem(i * 2 + 1)}>
              {titulo}
            </h3>
            <p className="rv-sobe leading-relaxed text-muted" style={ordem(i * 2 + 1)}>
              {texto}
            </p>
          </li>
        ))}
      </ol>
      <ul data-revela className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RECURSOS.map(({ icone: Icone, cor, titulo, texto }, i) => (
          <li key={titulo} className="rv-sobe card flex flex-col gap-2.5 rounded-[1.25rem] p-6" style={ordem(i)}>
            <Icone size={26} className={cor} aria-hidden="true" />
            <h3 className="text-[1.15rem] font-bold">{titulo}</h3>
            <p className="leading-relaxed text-muted">{texto}</p>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap items-center gap-2.5">
        <p className="mr-1.5 text-[0.95rem] text-muted">Todas as áreas da prova:</p>
        {AREAS.map(({ nome, cor }) => (
          <span key={nome} className={`rounded-full px-3.5 py-2 text-[0.95rem] font-semibold ${cor}`}>
            {nome}
          </span>
        ))}
      </div>
    </section>
  );
}

function Tabela() {
  return (
    <section aria-labelledby="tabela-titulo" id="tabela" className="mx-auto max-w-[1200px] px-4 pt-28 sm:px-6">
      <div data-revela className="flex flex-col gap-4.5">
        <h2 id="tabela-titulo" className={`rv-sobe max-w-[820px] ${TITULO_H2}`}>
          A tabela periódica inteira, com as tendências que o ENEM cobra.
        </h2>
        <p className="rv-sobe max-w-[46em] text-lg leading-relaxed text-muted" style={ordem(1)}>
          Os 118 elementos na posição da IUPAC, com a ficha de cada um e a fonte de cada dado. Escolha uma
          tendência e veja para onde ela cresce. No app ainda tem distribuição eletrônica passo a passo, massa
          molar e comparação entre elementos.
        </p>
      </div>
      <div data-revela className="mt-10">
        <TabelaPrevia />
      </div>
      <a
        href={`${APP_URL}tabela-periodica`}
        className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-brand hover:underline"
      >
        Abrir a tabela periódica
        <ArrowRight size={16} weight="bold" />
      </a>
    </section>
  );
}

// Uma amostra dos temas, de ponta a ponta do arquivo (todos estão no app).
const ANOS_DA_AMOSTRA = [2025, 2024, 2019, 2013, 1998];

function Redacoes() {
  const amostra = ANOS_DA_AMOSTRA.map((ano) => temas.find((t) => t.ano === ano && t.aplicacao === 'regular')).filter(
    (t) => t !== undefined,
  );
  return (
    <section
      aria-labelledby="redacoes-titulo"
      id="redacoes"
      className="mx-auto grid max-w-[1200px] items-start gap-12 px-4 pt-28 sm:px-6 lg:grid-cols-2 lg:gap-14"
    >
      <div data-revela className="flex flex-col gap-4.5">
        <h2 id="redacoes-titulo" className={`rv-sobe ${TITULO_H2}`}>
          Todos os temas de redação, como saíram na prova.
        </h2>
        <p className="rv-sobe text-lg leading-relaxed text-muted" style={ordem(1)}>
          De 1998 a 2025, da aplicação regular à reaplicação e às demais. Cada tema traz a proposta, os
          textos motivadores e a página do caderno. Nada resumido, nada reescrito.
        </p>
        <a
          href={APP_URL}
          className="inline-flex min-h-11 items-center gap-2 self-start font-semibold text-brand hover:underline"
        >
          Ver os {temas.length} temas
          <ArrowRight size={16} weight="bold" />
        </a>
      </div>
      <ul data-revela className="flex flex-col gap-2.5">
        {amostra.map((t, i) => (
          <li key={t.ano} className="rv-sobe card flex items-baseline gap-5 px-5 py-4.5" style={ordem(i)}>
            <span className="font-data text-sm font-semibold text-red">{t.ano}</span>
            <span className="font-semibold">{t.tema}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LinhasDoCaderno({ larguras, desde }: { larguras: string[]; desde: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      {larguras.map((w, i) =>
        w === 'figura' ? (
          <div key={i} className="rv-linha h-11 rounded bg-line" style={ordem(desde + i)} />
        ) : (
          <div key={i} className="rv-linha h-1.5 rounded-sm bg-line" style={ordem(desde + i, { width: w })} />
        ),
      )}
    </div>
  );
}

const PAUSA_DA_LOUSA_MS = 900;

/**
 * O tempo restante da lousa. Como no quadro da sala, a marca não corre: de
 * tempos em tempos ela é apagada e reescrita. Ao aparecer, a lousa mostra a
 * marca anterior (2h45), apaga e escreve a atual (2h30), que é o que o HTML
 * pré-renderizado e o movimento reduzido mostram direto.
 */
function TempoRestante() {
  const ref = useRef<HTMLParagraphElement>(null);
  const { espera, apareceu } = useAoAparecer(ref);
  const [trocou, setTrocou] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!apareceu || !el) return;
    let animacao: Animation | undefined;
    const pausa = window.setTimeout(() => {
      // O apagador passa da esquerda para a direita.
      animacao = el.animate(
        [
          { clipPath: 'inset(0 0 0 0)', opacity: 1 },
          { clipPath: 'inset(0 0 0 100%)', opacity: 0.35 },
        ],
        { duration: 420, easing: 'cubic-bezier(0.77, 0, 0.175, 1)', fill: 'forwards' },
      );
      animacao.onfinish = () => setTrocou(true);
    }, PAUSA_DA_LOUSA_MS);
    return () => {
      window.clearTimeout(pausa);
      animacao?.cancel();
    };
  }, [apareceu]);

  useEffect(() => {
    const el = ref.current;
    if (!trocou || !el) return;
    // E o giz escreve a marca nova, no mesmo sentido (o apagador sai antes).
    for (const a of el.getAnimations()) a.cancel();
    const animacao = el.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], {
      duration: 640,
      easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
    });
    return () => animacao.cancel();
  }, [trocou]);

  const anterior = espera || (apareceu && !trocou);
  return (
    <p ref={ref} className="font-display text-[2.1rem] leading-tight font-extrabold sm:text-[2.5rem]">
      {anterior ? '2h45' : '2h30'}
    </p>
  );
}

function NoPapel() {
  return (
    <section aria-labelledby="papel-titulo" id="papel" className="mt-28 border-y border-line bg-surface">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-24 sm:px-6 sm:py-28 lg:grid-cols-2 lg:gap-14">
        {/* Esboço do caderno em PDF e da lousa: ilustração, sem conteúdo real. */}
        <div aria-hidden="true" data-revela className="grid grid-cols-2 items-end gap-4">
          <div className="flex aspect-[0.72] flex-col gap-2.5 rounded-xl border border-line bg-surface-2 p-4 shadow-[var(--shadow)]">
            <div className="rv-linha h-2.5 w-[55%] rounded-sm bg-brand" style={ordem(-3)} />
            <div className="grid flex-1 grid-cols-2 gap-2.5">
              <LinhasDoCaderno larguras={['100%', '100%', '70%', 'figura', '100%', '60%']} desde={0} />
              <LinhasDoCaderno larguras={['100%', '80%', '100%', '50%', '100%', '75%']} desde={6} />
            </div>
            <p className="font-data text-[0.7rem] text-muted">Caderno · 2 colunas · PDF</p>
          </div>
          {/* A lousa tem cores fixas, como no app (fora dos temas). */}
          <div className="flex aspect-[0.86] flex-col gap-3.5 rounded-xl border-8 border-[#6b4a32] bg-[#1f2b25] p-5 text-[#eef3ea]">
            <p className="font-data text-xs tracking-[0.1em] uppercase opacity-80">Quadro da sala</p>
            <div className="font-display text-lg leading-snug sm:text-xl">
              <p>
                Início <strong>13h30</strong>
              </p>
              <p>
                Término <strong>19h00</strong>
              </p>
            </div>
            <div className="border-t border-dashed border-[#eef3ea]/40 pt-3">
              <p className="text-sm opacity-85">Tempo restante</p>
              <TempoRestante />
            </div>
          </div>
        </div>
        <div data-revela className="flex flex-col gap-4.5">
          <h2 id="papel-titulo" className={`rv-sobe ${TITULO_H2}`}>
            Prefere fazer a prova impressa? Também dá.
          </h2>
          <p className="rv-sobe text-lg leading-relaxed text-muted" style={ordem(1)}>
            Gere o caderno em PDF no padrão do ENEM: duas colunas, capa, cartão-resposta, gabarito e
            comentários se quiser, na cor do seu tema.
          </p>
          <p className="rv-sobe text-lg leading-relaxed text-muted" style={ordem(2)}>
            Na hora de fazer, abra o quadro da sala em tela cheia: início, término e o tempo restante,
            atualizado de tempos em tempos, como o fiscal faz no quadro.
          </p>
        </div>
      </div>
    </section>
  );
}

const COMANDOS = [
  `git clone ${GITHUB_URL}.git`,
  'cd OpENEM',
  'cp .env.example .env',
  'docker compose up --build',
];

// Cada comando é "digitado" depois do anterior: um tique por caractere
// (24 ms, ver .rv-digita) e uma pausa curta, como quem confere antes do Enter.
const TIQUE_MS = 24;
const PAUSA_ENTRE_COMANDOS_MS = 220;
const DIGITACAO = COMANDOS.reduce<{ n: number; atraso: number }[]>((acc, c) => {
  const ant = acc[acc.length - 1];
  const atraso = ant ? ant.atraso + ant.n * TIQUE_MS + PAUSA_ENTRE_COMANDOS_MS : 300;
  return [...acc, { n: c.length + 2, atraso }];
}, []);

function Aberto() {
  return (
    // Sempre no escuro padrão: os seletores de tema valem em qualquer elemento.
    <section aria-labelledby="aberto-titulo" id="aberto" data-theme="default-dark" className="bg-bg text-fg">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-24 sm:px-6 sm:py-28 lg:grid-cols-2 lg:gap-14">
        <div data-revela className="flex flex-col gap-4.5">
          <h2 id="aberto-titulo" className={`rv-sobe ${TITULO_H2}`}>
            Aberto de verdade. Rode o seu.
          </h2>
          <p className="rv-sobe text-lg leading-relaxed text-muted" style={ordem(1)}>
            O código é AGPL-3.0. Escola, cursinho popular ou coletivo pode subir o próprio OpENEM: banco,
            API e app num comando, com as provas oficiais importadas na primeira vez.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-3">
            <a href={`${DOCS_URL}hospedar/instalacao/`} className="btn btn-primary aperta min-h-12 px-5 text-base">
              Guia de instalação
            </a>
            <a href={`${DOCS_URL}contribuir/desenvolvimento/`} className="btn btn-ghost aperta min-h-12 px-5 text-base">
              Como contribuir
            </a>
          </div>
          <p className="text-[0.95rem] text-muted">
            Gratuito e sem anúncios, mantido por quem patrocina.{' '}
            <a
              href={SPONSOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-fg underline decoration-line underline-offset-4 hover:decoration-current"
            >
              <Heart size={15} weight="fill" className="text-brand" aria-hidden />
              Patrocinar no GitHub
            </a>
          </p>
        </div>
        <div data-revela className="card overflow-hidden rounded-[1.25rem]">
          <p className="font-data border-b border-line bg-surface-2 px-5.5 py-3 text-xs text-muted">terminal</p>
          <pre className="font-data overflow-x-auto p-5.5 text-sm leading-[1.9]">
            <code>
              {COMANDOS.map((c, i) => (
                <span
                  key={c}
                  className="rv-digita block w-fit"
                  style={{ '--n': DIGITACAO[i].n, '--rv-atraso': `${DIGITACAO[i].atraso}ms` } as CSSProperties}
                >
                  <span className="text-muted select-none">$ </span>
                  {c}
                </span>
              ))}
            </code>
          </pre>
          <p className="border-t border-line px-5.5 py-3.5 text-sm text-muted">
            No <code className="font-data">.env</code>, defina <code className="font-data">POSTGRES_PASSWORD</code> e{' '}
            <code className="font-data">JWT_SECRET</code> antes de subir.
          </p>
        </div>
      </div>
    </section>
  );
}

export function Landing() {
  const raiz = useRef<HTMLDivElement>(null);
  useRevelar(raiz);
  return (
    <div ref={raiz} className="min-h-dvh bg-bg text-fg">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <Cabecalho />

      <main id="conteudo">
        <Hero />
        <Numeros />
        <Recursos />
        <Tabela />
        <Redacoes />
        <NoPapel />
        <Aberto />

        <section
          aria-labelledby="fim-titulo"
          data-revela
          className="mx-auto flex max-w-[1200px] flex-col items-center gap-5.5 px-4 py-28 text-center sm:px-6 sm:py-32"
        >
          <h2
            id="fim-titulo"
            className="rv-sobe max-w-[14em] font-display text-[2.5rem] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl lg:text-[4rem]"
          >
            Sua próxima questão está a um clique.
          </h2>
          <p className="rv-sobe max-w-[34em] text-lg leading-relaxed text-muted" style={ordem(1)}>
            Crie a conta, diga sua meta e quantos minutos tem por dia, e comece pela prova que quiser.
          </p>
          <div className="rv-sobe mt-1" style={ordem(2)}>
            <BotaoEstudar className="py-4 text-lg" />
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-6 px-4 pt-9 pb-12 sm:px-6">
          <div className="flex max-w-[30em] flex-col gap-1.5">
            <Wordmark />
            <p className="text-[0.95rem] text-muted">
              Preparação gratuita e de código aberto para o ENEM. Questões e temas de redação são das provas
              oficiais do INEP; o OpENEM não tem vínculo com o INEP.
            </p>
          </div>
          <nav aria-label="Rodapé" className="flex flex-wrap items-start gap-x-6 gap-y-2 text-[0.95rem]">
            <a href={DOCS_URL} className="text-muted hover:text-fg">
              Documentação
            </a>
            <a href={`${DOCS_URL}alunos/perguntas-frequentes/`} className="text-muted hover:text-fg">
              Perguntas frequentes
            </a>
            <a href={GITHUB_URL} className="text-muted hover:text-fg">
              GitHub
            </a>
            <a href={SPONSOR_URL} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-fg">
              Patrocinar
            </a>
            <a href={`${GITHUB_URL}/blob/main/LICENSE`} className="text-muted hover:text-fg">
              Licença AGPL-3.0
            </a>
            <a href={`${GITHUB_URL}/blob/main/SECURITY.md`} className="text-muted hover:text-fg">
              Segurança
            </a>
            <a href="/privacidade/" className="text-muted hover:text-fg">
              Privacidade
            </a>
            <a href="/termos/" className="text-muted hover:text-fg">
              Termos de uso
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
