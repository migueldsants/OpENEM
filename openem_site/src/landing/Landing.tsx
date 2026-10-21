import { ArrowRight, GithubLogo, Plus } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Wordmark } from '../components/Wordmark';
import { APP_URL, DOCS_URL, GITHUB_URL } from '../config';
import { Arquivo } from './Arquivo';
import { FaixaDeTemas } from './FaixaDeTemas';
import { ETAPAS, minutoDaEtapa } from './hora';
import { QuestaoAoVivo } from './QuestaoAoVivo';
import { Regua } from './Regua';

/** Índice da etapa que cruza o meio da tela (-1 = topo, ETAPAS.length = fim). */
function useEtapaAtiva(raiz: React.RefObject<HTMLElement | null>) {
  const [ativa, setAtiva] = useState(-1);
  useEffect(() => {
    const el = raiz.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const alvos = el.querySelectorAll<HTMLElement>('[data-etapa]');
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) setAtiva(Number(e.target.getAttribute('data-etapa')));
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    alvos.forEach((a) => io.observe(a));
    return () => io.disconnect();
  }, [raiz]);
  return ativa;
}

function Tela({ id, alt, eager = false }: { id: string; alt: string; eager?: boolean }) {
  const comum = {
    width: 390,
    height: 844,
    alt,
    decoding: 'async' as const,
    loading: eager ? ('eager' as const) : ('lazy' as const),
    className: 'h-full w-full object-cover object-top',
  };
  return (
    <>
      <img src={`/telas/${id}-clara.webp`} {...comum} className={`tela-clara ${comum.className}`} />
      <img src={`/telas/${id}-escura.webp`} {...comum} className={`tela-escura ${comum.className}`} />
    </>
  );
}

function BotaoEstudar({ className = '' }: { className?: string }) {
  return (
    <a href={APP_URL} className={`btn btn-primary aperta px-4 py-3 text-base sm:px-5 ${className}`}>
      Começar a estudar
      <ArrowRight size={18} weight="bold" />
    </a>
  );
}

function Cabecalho() {
  return (
    <header className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:px-6">
      <Wordmark />
      <nav aria-label="Principal" className="flex items-center gap-1 sm:gap-2">
        <a
          href={DOCS_URL}
          className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-fg sm:inline-block"
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
        <a href={APP_URL} className="btn btn-ghost aperta">
          Entrar
        </a>
      </nav>
    </header>
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
    <section aria-labelledby={`${id}-titulo`} className={`mx-auto max-w-[1240px] px-4 sm:px-6 ${className}`}>
      <h2
        id={`${id}-titulo`}
        className="max-w-[18ch] font-display text-[2rem] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance sm:text-5xl"
      >
        {titulo}
      </h2>
      {texto && <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-muted sm:text-lg">{texto}</p>}
      <div className="mt-10 sm:mt-12">{children}</div>
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
    texto: 'Duas colunas, cartão-resposta e gabarito, para imprimir nas cores que você quiser.',
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
  const historia = useRef<HTMLDivElement>(null);
  const ativa = useEtapaAtiva(historia);
  const minuto = minutoDaEtapa(ativa);
  const telaAtiva = Math.min(ativa, ETAPAS.length - 1);

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
        {/* A hora: régua e celular fixos no desktop, a história rola entre eles. */}
        <div
          ref={historia}
          className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:grid lg:grid-cols-[3.5rem_minmax(0,1fr)_auto] lg:gap-x-10 xl:gap-x-16"
        >
          <div className="hidden lg:block">
            <div className="sticky top-24 h-[calc(100dvh-10rem)] max-h-[44rem]">
              <Regua minuto={minuto} orientacao="vertical" />
            </div>
          </div>

          <div className="min-w-0">
            <section data-etapa="-1" aria-labelledby="titulo" className="pt-4 pb-14 sm:pt-10 lg:min-h-[calc(100dvh-4rem)] lg:pt-16 lg:pb-24">
              <Regua minuto={0} orientacao="horizontal" className="max-w-sm lg:hidden" />
              <h1
                id="titulo"
                className="mt-6 max-w-[13ch] font-display text-[2.6rem] leading-[1] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl lg:mt-0 lg:max-w-[23ch] lg:text-[3.5rem] xl:text-[3.75rem]"
              >
                Uma hora por dia com a <span className="text-brand">prova de verdade.</span>
              </h1>
              <p className="mt-5 max-w-[40ch] text-[1.05rem] leading-relaxed text-muted sm:text-xl">
                Questões oficiais do ENEM de 1998 a 2025, simulados no padrão da prova e revisão do
                que você errou.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2">
                <BotaoEstudar />
                <p className="text-sm font-medium whitespace-nowrap text-muted">Grátis, sem anúncio</p>
              </div>

              {/* No celular, a questão vem logo abaixo, dentro do aparelho. */}
              <div id="questao" className="mt-10 flex justify-center lg:hidden">
                <div className="celular max-w-[21rem]">
                  <div className="celular-tela">
                    <QuestaoAoVivo />
                  </div>
                </div>
              </div>
              <p className="mt-10 hidden max-w-[34ch] text-sm leading-relaxed text-muted lg:block">
                As questões no celular ao lado são de provas oficiais. Responda uma: é assim que
                funciona no app.
              </p>
            </section>

            {/* No celular, a régua acompanha a rolagem no topo da tela. */}
            <div className="filterbar -mx-4 border-b border-line px-4 py-1 sm:-mx-6 sm:px-6 lg:hidden">
              <Regua minuto={minuto} orientacao="horizontal" />
            </div>

            <ol aria-label="Uma hora de estudo no OpENEM">
              {ETAPAS.map((e, i) => (
                <li
                  key={e.id}
                  data-etapa={i}
                  className="grid gap-8 py-14 sm:py-20 lg:min-h-[72dvh] lg:content-center lg:py-0"
                >
                  <div>
                    <h2 className="max-w-[16ch] font-display text-[2rem] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance sm:text-5xl">
                      {e.titulo}
                    </h2>
                    {/* O intervalo abre o texto (a régua mostra o minuto); não é rótulo solto acima do título. */}
                    <p className="mt-4 max-w-[44ch] text-base leading-relaxed text-muted sm:text-lg">
                      <span className="font-data font-medium whitespace-nowrap text-brand tabular-nums">
                        {e.inicio} a {e.fim} min.
                      </span>{' '}
                      {e.texto}
                    </p>
                  </div>
                  <figure className="flex justify-center lg:hidden">
                    <div className="celular celular-pequeno max-w-[17rem]">
                      <div className="celular-tela">
                        <Tela id={e.id} alt={e.alt} />
                      </div>
                    </div>
                  </figure>
                </li>
              ))}
            </ol>
          </div>

          <div className="hidden lg:block">
            <div className="sticky top-[5.5rem] py-4">
              <div className="celular w-[min(22.5rem,calc((100dvh_-_8.7rem)_*_0.462_+_1.2rem))]">
                <div className="celular-tela">
                  <div className="camada" data-ativa={ativa < 0}>
                    <QuestaoAoVivo />
                  </div>
                  {ETAPAS.map((e, i) => (
                    <div key={e.id} className="camada" data-ativa={ativa >= 0 && telaAtiva === i} aria-hidden={telaAtiva !== i}>
                      <Tela id={e.id} alt={e.alt} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Fim da hora: a régua fecha em 60. */}
          <div data-etapa={ETAPAS.length} className="h-px lg:col-span-3" />
        </div>

        <Secao
          id="simulado"
          titulo="No fim de semana, a prova inteira."
          className="pt-16 sm:pt-24"
        >
          <div className="grid gap-4 md:grid-cols-6 md:grid-rows-[auto_auto]">
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
                        : 'border-brand/25 bg-brand/6 md:col-span-2'
                }`}
              >
                <div className="p-5 sm:p-6">
                  <h3 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{s.titulo}</h3>
                  <p className="mt-2 max-w-[42ch] text-[0.95rem] leading-relaxed text-muted">{s.texto}</p>
                </div>
                <div
                  className={`px-5 sm:px-6 ${
                    // O caderno ocupa a altura do bloco (duas linhas da grade).
                    i === 1 ? 'min-h-0 flex-1 pb-5 sm:pb-6 md:[&_img]:h-full md:[&_picture]:block md:[&_picture]:h-full' : 'mt-auto'
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
          titulo="Todas as provas, desde 1998."
          texto="Toque num ano para ver o tema da redação daquela prova. As questões de cada uma estão no app."
          className="pt-24 sm:pt-32"
        >
          <Arquivo />
        </Secao>

        <Secao
          id="celular"
          titulo="Do jeito que você estuda."
          texto="Instala direto do navegador, sem loja, e as questões que você já abriu continuam ali sem internet. São 18 temas de cor, do claro ao OLED, com um de alto contraste."
          className="pt-24 sm:pt-32"
        >
          <FaixaDeTemas />
        </Secao>

        <section aria-labelledby="livre-titulo" className="mt-24 border-y border-line bg-surface sm:mt-32">
          <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 sm:py-24">
            <h2
              id="livre-titulo"
              className="max-w-[20ch] font-display text-[2rem] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance sm:text-5xl"
            >
              Ninguém cobra. O&nbsp;código é aberto.
            </h2>
            <p className="mt-5 max-w-[56ch] text-base leading-relaxed text-muted sm:text-lg">
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
        </section>

        <Secao id="perguntas" titulo="Perguntas frequentes" className="pt-24 sm:pt-32">
          <div className="faq max-w-3xl divide-y divide-line border-y border-line">
            {PERGUNTAS.map(({ p, r }) => (
              <details key={p} className="group">
                <summary className="flex items-center justify-between gap-4 py-5 text-lg font-semibold">
                  {p}
                  <Plus size={20} className="seta shrink-0 text-muted" />
                </summary>
                <p className="max-w-[60ch] pb-6 leading-relaxed text-muted">{r}</p>
              </details>
            ))}
          </div>
        </Secao>

        <section aria-labelledby="fim-titulo" className="mx-auto max-w-[1240px] px-4 pt-24 pb-20 sm:px-6 sm:pt-32 sm:pb-28">
          <h2
            id="fim-titulo"
            className="max-w-[16ch] font-display text-[2.4rem] leading-[1] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl"
          >
            Sua próxima hora de estudo começa agora.
          </h2>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <BotaoEstudar />
            <p className="text-sm text-muted">Grátis, sem anúncio.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
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
