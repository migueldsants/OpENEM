import {
  ArrowRight,
  Cards,
  ChartBar,
  ChatsCircle,
  Flame,
  GithubLogo,
  Palette,
  Timer,
  type Icon,
} from '@phosphor-icons/react';
import { useSyncExternalStore } from 'react';
import temas from 'virtual:arquivo-redacoes';
import { Wordmark } from '../components/Wordmark';
import { APP_URL, DOCS_URL, GITHUB_URL } from '../config';
import { Caderno } from './Caderno';
import { ANOS_DO_ENEM } from './prova';

/** Questões oficiais no banco (1998 a 2025, todas as aplicações). */
const QUESTOES_OFICIAIS = '7.781';

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
      <nav aria-label="Seções" className="hidden gap-7 text-[0.95rem] font-medium md:flex">
        <a href="#recursos" className="text-muted hover:text-fg">
          Recursos
        </a>
        <a href="#redacoes" className="text-muted hover:text-fg">
          Redações
        </a>
        <a href="#papel" className="text-muted hover:text-fg">
          No papel
        </a>
        <a href="#aberto" className="text-muted hover:text-fg">
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

function Numeros() {
  const itens: { valor: string; texto: string }[] = [
    { valor: QUESTOES_OFICIAIS, texto: 'questões oficiais, com gabarito' },
    { valor: `${ANOS_DO_ENEM.length} anos`, texto: `de provas, de ${ANOS_DO_ENEM[0]} a ${ANOS_DO_ENEM[ANOS_DO_ENEM.length - 1]}` },
    { valor: `${temas.length} temas`, texto: 'de redação, com a página do caderno' },
    { valor: 'R$ 0', texto: 'para estudar, sem limite de questões' },
  ];
  return (
    <section aria-label="O OpENEM em números" className="border-y border-line bg-surface">
      <dl className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-6 gap-y-8 px-4 py-9 sm:px-6 lg:grid-cols-4">
        {itens.map(({ valor, texto }) => (
          <div key={valor} className="flex flex-col-reverse">
            <dt className="text-[0.95rem] text-muted">{texto}</dt>
            <dd className="font-display text-[2.1rem] leading-tight font-extrabold tracking-[-0.03em] sm:text-[2.75rem]">
              {valor}
            </dd>
          </div>
        ))}
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
      <h2 id="recursos-titulo" className={`max-w-[760px] ${TITULO_H2}`}>
        Pratique, simule, revise. E repita até a prova.
      </h2>
      <ol className="mt-14 grid gap-10 md:grid-cols-3">
        {PASSOS.map(({ titulo, texto }, i) => (
          <li key={titulo} className="flex flex-col gap-3 border-t-2 border-fg pt-5">
            <span className="font-data text-sm text-muted">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="font-display text-[1.75rem] font-bold tracking-tight">{titulo}</h3>
            <p className="leading-relaxed text-muted">{texto}</p>
          </li>
        ))}
      </ol>
      <ul className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RECURSOS.map(({ icone: Icone, cor, titulo, texto }) => (
          <li key={titulo} className="card flex flex-col gap-2.5 rounded-[1.25rem] p-6">
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
      <div className="flex flex-col gap-4.5">
        <h2 id="redacoes-titulo" className={TITULO_H2}>
          Todos os temas de redação, como saíram na prova.
        </h2>
        <p className="text-lg leading-relaxed text-muted">
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
      <ul className="flex flex-col gap-2.5">
        {amostra.map((t) => (
          <li key={t.ano} className="card flex items-baseline gap-5 px-5 py-4.5">
            <span className="font-data text-sm font-semibold text-red">{t.ano}</span>
            <span className="font-semibold">{t.tema}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LinhasDoCaderno({ larguras }: { larguras: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {larguras.map((w, i) =>
        w === 'figura' ? (
          <div key={i} className="h-11 rounded bg-line" />
        ) : (
          <div key={i} className="h-1.5 rounded-sm bg-line" style={{ width: w }} />
        ),
      )}
    </div>
  );
}

function NoPapel() {
  return (
    <section aria-labelledby="papel-titulo" id="papel" className="mt-28 border-y border-line bg-surface">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-24 sm:px-6 sm:py-28 lg:grid-cols-2 lg:gap-14">
        {/* Esboço do caderno em PDF e da lousa: ilustração, sem conteúdo real. */}
        <div aria-hidden="true" className="grid grid-cols-2 items-end gap-4">
          <div className="flex aspect-[0.72] flex-col gap-2.5 rounded-xl border border-line bg-surface-2 p-4 shadow-[var(--shadow)]">
            <div className="h-2.5 w-[55%] rounded-sm bg-brand" />
            <div className="grid flex-1 grid-cols-2 gap-2.5">
              <LinhasDoCaderno larguras={['100%', '100%', '70%', 'figura', '100%', '60%']} />
              <LinhasDoCaderno larguras={['100%', '80%', '100%', '50%', '100%', '75%']} />
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
              <p className="font-display text-[2.1rem] leading-tight font-extrabold sm:text-[2.5rem]">2h30</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4.5">
          <h2 id="papel-titulo" className={TITULO_H2}>
            Prefere fazer a prova impressa? Também dá.
          </h2>
          <p className="text-lg leading-relaxed text-muted">
            Gere o caderno em PDF no padrão do ENEM: duas colunas, capa, cartão-resposta, gabarito e
            comentários se quiser, na cor do seu tema.
          </p>
          <p className="text-lg leading-relaxed text-muted">
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

function Aberto() {
  return (
    // Sempre no escuro padrão: os seletores de tema valem em qualquer elemento.
    <section aria-labelledby="aberto-titulo" id="aberto" data-theme="default-dark" className="bg-bg text-fg">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-24 sm:px-6 sm:py-28 lg:grid-cols-2 lg:gap-14">
        <div className="flex flex-col gap-4.5">
          <h2 id="aberto-titulo" className={TITULO_H2}>
            Aberto de verdade. Rode o seu.
          </h2>
          <p className="text-lg leading-relaxed text-muted">
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
        </div>
        <div className="card overflow-hidden rounded-[1.25rem]">
          <p className="font-data border-b border-line bg-surface-2 px-5.5 py-3 text-xs text-muted">terminal</p>
          <pre className="font-data overflow-x-auto p-5.5 text-sm leading-[1.9]">
            <code>
              {COMANDOS.map((c) => (
                <span key={c} className="block">
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
        <Numeros />
        <Recursos />
        <Redacoes />
        <NoPapel />
        <Aberto />

        <section
          aria-labelledby="fim-titulo"
          className="mx-auto flex max-w-[1200px] flex-col items-center gap-5.5 px-4 py-28 text-center sm:px-6 sm:py-32"
        >
          <h2
            id="fim-titulo"
            className="max-w-[14em] font-display text-[2.5rem] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl lg:text-[4rem]"
          >
            Sua próxima questão está a um clique.
          </h2>
          <p className="max-w-[34em] text-lg leading-relaxed text-muted">
            Crie a conta, diga sua meta e quantos minutos tem por dia, e comece pela prova que quiser.
          </p>
          <BotaoEstudar className="mt-1 py-4 text-lg" />
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
