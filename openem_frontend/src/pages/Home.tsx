import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import {
  IconBook,
  IconCalendar,
  IconChart,
  IconClock,
  IconFormula,
  IconPen,
  IconStack,
  IconTarget,
  IconTimer,
} from '../components/icons';

interface Atalho {
  to: string;
  titulo: string;
  descricao: string;
  Icon: typeof IconStack;
  /** Classes de fundo + texto do ícone, no tom da seção. */
  tom: string;
  /** Contador opcional (ex.: assuntos vencidos na revisão). */
  selo?: number;
}

/**
 * Home: um hub de navegação, sem métricas — essas ficam no Painel. A única
 * informação é o selo de revisão vencida, porque ele diz para onde ir agora.
 */
export default function Home() {
  const { me } = useAuth();
  const name = me?.profile?.displayName?.split(' ')[0];
  const [vencidas, setVencidas] = useState(0);

  useEffect(() => {
    void api
      .reviewQueue()
      .then((fila) => setVencidas(fila.length))
      // Sem o selo o hub continua funcionando: não vale um erro na tela.
      .catch(() => setVencidas(0));
  }, []);

  const atalhos: Atalho[] = [
    {
      to: '/questoes',
      titulo: 'Questões',
      descricao: 'Banco oficial do ENEM',
      Icon: IconStack,
      tom: 'bg-mat/12 text-mat',
    },
    {
      to: '/simulados',
      titulo: 'Simulados',
      descricao: 'Provas oficiais e personalizados',
      Icon: IconTimer,
      tom: 'bg-brand/12 text-brand',
    },
    {
      to: '/painel',
      titulo: 'Painel',
      descricao: 'Desempenho e progresso',
      Icon: IconChart,
      tom: 'bg-nat/12 text-nat',
    },
    {
      to: '/revisao',
      titulo: 'Revisão',
      descricao:
        vencidas > 0
          ? `${vencidas} ${vencidas === 1 ? 'assunto vencido' : 'assuntos vencidos'}`
          : 'Revisão espaçada',
      Icon: IconTarget,
      tom: 'bg-hum/12 text-hum',
      selo: vencidas,
    },
    {
      to: '/redacao',
      titulo: 'Redação',
      descricao: 'Nota por competência',
      Icon: IconPen,
      tom: 'bg-red/12 text-red',
    },
    {
      to: '/cronograma',
      titulo: 'Cronograma',
      descricao: 'Seu plano de estudos',
      Icon: IconCalendar,
      tom: 'bg-lin/12 text-lin',
    },
    {
      to: '/flashcards',
      titulo: 'Flashcards',
      descricao: 'Memorização ativa',
      Icon: IconBook,
      tom: 'bg-hum/12 text-hum',
    },
    {
      to: '/formulas',
      titulo: 'Fórmulas',
      descricao: 'A cola essencial',
      Icon: IconFormula,
      tom: 'bg-mat/12 text-mat',
    },
    {
      to: '/pomodoro',
      titulo: 'Pomodoro',
      descricao: 'Sessões de foco',
      Icon: IconClock,
      tom: 'bg-brand/12 text-brand',
    },
  ];

  return (
    <div className="space-y-7">
      <header>
        <p className="eyebrow">Início</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {name ? `Bora estudar, ${name}?` : 'Bora estudar?'}
        </h1>
      </header>

      <nav aria-label="Atalhos">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {atalhos.map(({ to, titulo, descricao, Icon, tom, selo }) => (
            <li key={to}>
              <NavLink
                to={to}
                className="card card-raised relative flex h-full flex-col gap-3 p-4 transition-transform hover:-translate-y-0.5"
              >
                <span
                  className={`grid size-11 place-items-center rounded-xl ${tom}`}
                >
                  <Icon width={22} height={22} />
                </span>
                <span>
                  <span className="block font-display font-bold">{titulo}</span>
                  <span className="text-xs text-muted">{descricao}</span>
                </span>
                {!!selo && (
                  <span
                    className="absolute right-3 top-3 grid min-w-6 place-items-center rounded-full bg-hum px-1.5 text-xs font-bold text-white"
                    aria-label={`${selo} para revisar`}
                  >
                    {selo}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
