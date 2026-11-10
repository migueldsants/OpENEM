// Ícones do app — Phosphor (pesos regular/bold/fill/duotone), expostos sob os
// nomes usados na base. O shim traduz a API antiga (width/height/filled) para a
// do Phosphor (size/weight), então os call sites seguem funcionando.
import {
  Flag,
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsClockwise,
  Books,
  Calculator,
  Certificate,
  ClipboardText,
  Crown,
  Cursor,
  Dna,
  Flask,
  Medal,
  MedalMilitary,
  PenNib,
  Path,
  PersonSimpleRun,
  Printer,
  Scroll,
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  Equals,
  Atom,
  Planet,
  ArrowRight,
  Cube,
  BookOpen,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  CaretDown,
  CaretUp,
  ChartLineUp,
  ChatsCircle,
  Check,
  Circle,
  Clock,
  Copy,
  ArrowsOut,
  Diamond,
  DotsThree,
  Eraser,
  Exam,
  Flame,
  BoundingBox,
  GithubLogo,
  GlobeHemisphereWest,
  Palette,
  Toolbox,
  UploadSimple,
  MagicWand,
  Hand,
  Heart,
  Hourglass,
  Highlighter,
  House,
  Image as ImageIcon,
  IconBase,
  type Icon as PhosphorIcon,
  type IconWeight,
  type IconProps,
  Lightning,
  LineSegment,
  LockSimple,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Minus,
  Moon,
  Note,
  NotePencil,
  Pause,
  Pi,
  PencilRuler,
  Play,
  Question,
  SignOut,
  SlidersHorizontal,
  Sparkle,
  Square,
  Star,
  Sun,
  Plus,
  Target,
  TextT,
  Timer,
  ThumbsUp,
  Trash,
  Trophy,
  User,
  Warning,
  X,
} from '@phosphor-icons/react';
import { forwardRef, type ReactElement } from 'react';

type ShimProps = Omit<IconProps, 'weight'> & {
  width?: number | string;
  height?: number | string;
  filled?: boolean;
  /** Ignorado (legado do set anterior baseado em stroke). */
  strokeWidth?: number;
  weight?: IconProps['weight'];
};

function shim(Base: PhosphorIcon, defaultWeight: IconProps['weight'] = 'regular') {
  const Wrapped = ({
    width,
    height,
    filled,
    strokeWidth: _strokeWidth,
    weight,
    ...rest
  }: ShimProps) => (
    <Base
      size={width ?? height ?? 22}
      weight={weight ?? (filled ? 'fill' : defaultWeight)}
      {...rest}
    />
  );
  return Wrapped;
}

// Navegação — duotone dá personalidade sem pesar.
export const IconHome = shim(House, 'duotone');
export const IconStack = shim(Exam, 'duotone');
export const IconCalendar = shim(CalendarBlank, 'duotone');
export const IconPen = shim(NotePencil, 'duotone');
export const IconToolbox = shim(Toolbox, 'duotone');
export const IconGithub = shim(GithubLogo, 'regular');
export const IconUser = shim(User, 'duotone');
export const IconTrophy = shim(Trophy, 'duotone');

// Ações e estados.
export const IconStar = shim(Star, 'regular');
export const IconHeart = shim(Heart, 'regular');
export const IconCheck = shim(Check, 'bold');
export const IconX = shim(X, 'bold');
export const IconChevronLeft = shim(CaretLeft, 'bold');
export const IconChevronRight = shim(CaretRight, 'bold');
export const IconChevronDown = shim(CaretDown, 'bold');
export const IconChevronUp = shim(CaretUp, 'bold');
// Variação de uma semana para a outra (Desempenho).
export const IconArrowUp = shim(ArrowUp, 'bold');
export const IconArrowDown = shim(ArrowDown, 'bold');
export const IconEquals = shim(Equals, 'bold');
export const IconFilter = shim(SlidersHorizontal, 'bold');
export const IconFlame = shim(Flame, 'fill');
export const IconBolt = shim(Lightning, 'fill');
export const IconLock = shim(LockSimple, 'regular');
export const IconLogout = shim(SignOut, 'bold');
export const IconSun = shim(Sun, 'bold');
export const IconMoon = shim(Moon, 'fill');
export const IconClock = shim(Clock, 'regular');
export const IconTimer = shim(Timer, 'duotone');
// Timers da tela de cronômetros.
export const IconHourglass = shim(Hourglass, 'duotone');
export const IconChat = shim(ChatsCircle, 'duotone');
export const IconTarget = shim(Target, 'duotone');
// Aba "Painel": métricas de estudo que antes ocupavam a Home.
export const IconChart = shim(ChartLineUp, 'duotone');
export const IconSparkle = shim(Sparkle, 'fill');
export const IconBook = shim(BookOpen, 'duotone');
export const IconQuestion = shim(Question, 'duotone');
export const IconThumbsUp = shim(ThumbsUp, 'duotone');
export const IconPlus = shim(Plus, 'bold');
// Botão "Mais" na tabbar mobile (issue #21) — elipse universal de "more".
export const IconMore = shim(DotsThree, 'bold');
// Item "Quadro" de estudos (issue #32) e ícone do botão "Anotar".
export const IconBoard = shim(PencilRuler, 'duotone');
// Ferramentas do editor de quadro (issue #32).
export const IconCursor = shim(Cursor, 'duotone');
export const IconHighlighter = shim(Highlighter, 'fill');
export const IconRect = shim(Square, 'duotone');
export const IconEllipse = shim(Circle, 'duotone');
export const IconLine = shim(LineSegment, 'duotone');
export const IconArrow = shim(ArrowUpRight, 'duotone');
export const IconDiamond = shim(Diamond, 'duotone');
export const IconText = shim(TextT, 'duotone');
export const IconFormula = shim(Pi, 'duotone');
export const IconAtom = shim(Atom, 'duotone');
export const IconPlanet = shim(Planet, 'duotone');
export const IconArrowRight = shim(ArrowRight, 'bold');
export const IconCube = shim(Cube, 'duotone');
export const IconGlobe = shim(GlobeHemisphereWest, 'duotone');
export const IconPalette = shim(Palette, 'duotone');
export const IconShare = shim(UploadSimple, 'bold');
export const IconWand = shim(MagicWand, 'duotone');
export const IconSticky = shim(Note, 'duotone');
export const IconNote = shim(NotePencil, 'duotone');
export const IconTrash = shim(Trash, 'duotone');
export const IconImage = shim(ImageIcon, 'duotone');
export const IconEraser = shim(Eraser, 'duotone');
// Copiar LaTeX no cheat sheet de fórmulas (issue #38).
export const IconCopy = shim(Copy, 'duotone');
// Expandir o detalhe de uma formula (issue #38).
export const IconExpand = shim(ArrowsOut, 'bold');
export const IconHand = shim(Hand, 'duotone');
export const IconMinus = shim(Minus, 'bold');
export const IconZoomIn = shim(MagnifyingGlassPlus, 'bold');
export const IconZoomOut = shim(MagnifyingGlassMinus, 'bold');
export const IconFit = shim(BoundingBox, 'bold');
// Banner de erro (issue #49).
export const IconAlert = shim(Warning, 'fill');
// Denunciar tópico ou resposta no fórum.
export const IconFlag = shim(Flag, 'duotone');
// Modo Foco / Pomodoro (issue #41).
export const IconPlay = shim(Play, 'fill');
export const IconPause = shim(Pause, 'fill');

// Conquistas — o catálogo da API manda uma chave de ícone (antes era emoji);
// `lib/achievement-icon` resolve a chave para um destes.
export const IconCrown = shim(Crown, 'duotone');
export const IconMedal = shim(Medal, 'duotone');
export const IconMedalMilitary = shim(MedalMilitary, 'duotone');
export const IconCertificate = shim(Certificate, 'duotone');
export const IconClipboard = shim(ClipboardText, 'duotone');
export const IconPenNib = shim(PenNib, 'duotone');
export const IconRepeat = shim(ArrowsClockwise, 'bold');
export const IconUndo = shim(ArrowCounterClockwise, 'bold');
export const IconRedo = shim(ArrowClockwise, 'bold');
export const IconBooks = shim(Books, 'duotone');
export const IconRun = shim(PersonSimpleRun, 'duotone');
/** Matérias e trilhas de estudo (discussão #122). */
export const IconPath = shim(Path, 'duotone');
// Matérias dos decks de flashcards (mesma resolução de chave).
export const IconDna = shim(Dna, 'duotone');
export const IconScroll = shim(Scroll, 'duotone');
export const IconCalculator = shim(Calculator, 'duotone');
export const IconFlask = shim(Flask, 'duotone');
// Impressão dos cadernos em PDF.
export const IconPrinter = shim(Printer, 'duotone');

// Tabela periódica: o Phosphor não tem; é a silhueta da tabela (duas colunas
// altas nas pontas, o miolo baixo e a faixa das séries f embaixo), desenhada
// no grid de 256 dele e montada com o IconBase, como os ícones da biblioteca.
const CONTORNO_TABELA =
  'M224 48h-32a8 8 0 0 0-8 8v40H72V56a8 8 0 0 0-8-8H32a8 8 0 0 0-8 8v104a8 8 0 0 0 8 8h192a8 8 0 0 0 8-8V56a8 8 0 0 0-8-8ZM40 64h16v88H40Zm32 48h48v40H72Zm64 0h48v40h-48Zm80 40h-16V64h16Zm-16 24H56a8 8 0 0 0-8 8v32a8 8 0 0 0 8 8h144a8 8 0 0 0 8-8v-32a8 8 0 0 0-8-8Zm-8 32H64v-16h128Z';
const PESOS_TABELA = new Map<IconWeight, ReactElement>([
  ['regular', <path key="r" d={CONTORNO_TABELA} />],
  ['bold', <path key="b" d={CONTORNO_TABELA} />],
  ['light', <path key="l" d={CONTORNO_TABELA} />],
  ['thin', <path key="t" d={CONTORNO_TABELA} />],
  ['fill', <path key="f" d="M224 48h-32a8 8 0 0 0-8 8v40H72V56a8 8 0 0 0-8-8H32a8 8 0 0 0-8 8v104a8 8 0 0 0 8 8h192a8 8 0 0 0 8-8V56a8 8 0 0 0-8-8Zm-24 128H56a8 8 0 0 0-8 8v32a8 8 0 0 0 8 8h144a8 8 0 0 0 8-8v-32a8 8 0 0 0-8-8Z" />],
  [
    'duotone',
    <>
      <path opacity="0.2" d="M32 56h32v104H32Zm160 0h32v104h-32ZM64 104h128v56H64Zm-8 80h144v32H56Z" />
      <path d={CONTORNO_TABELA} />
    </>,
  ],
]);
// Fica no arquivo para ser exportado pelo shim, como os outros ícones.
// eslint-disable-next-line react-refresh/only-export-components
const TabelaPeriodica = forwardRef<SVGSVGElement, IconProps>((props, ref) => (
  <IconBase ref={ref} {...props} weights={PESOS_TABELA} />
)) as PhosphorIcon;
TabelaPeriodica.displayName = 'TabelaPeriodica';
export const IconTabelaPeriodica = shim(TabelaPeriodica, 'duotone');
