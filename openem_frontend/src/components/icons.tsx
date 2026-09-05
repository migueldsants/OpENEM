// Ícones do app — Phosphor (pesos regular/bold/fill/duotone), expostos sob os
// nomes usados na base. O shim traduz a API antiga (width/height/filled) para a
// do Phosphor (size/weight), então os call sites seguem funcionando.
import {
  Cursor,
  ArrowUpRight,
  Atom,
  BookOpen,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  CaretDown,
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
  GlobeHemisphereWest,
  Hand,
  Heart,
  Highlighter,
  House,
  Image as ImageIcon,
  type Icon as PhosphorIcon,
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
export const IconFilter = shim(SlidersHorizontal, 'bold');
export const IconFlame = shim(Flame, 'fill');
export const IconBolt = shim(Lightning, 'fill');
export const IconLock = shim(LockSimple, 'regular');
export const IconLogout = shim(SignOut, 'bold');
export const IconSun = shim(Sun, 'bold');
export const IconMoon = shim(Moon, 'fill');
export const IconClock = shim(Clock, 'regular');
export const IconTimer = shim(Timer, 'duotone');
export const IconChat = shim(ChatsCircle, 'duotone');
export const IconTarget = shim(Target, 'duotone');
export const IconSparkle = shim(Sparkle, 'fill');
export const IconGame = shim(Lightning, 'duotone');
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
export const IconGlobe = shim(GlobeHemisphereWest, 'duotone');
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
// Modo Foco / Pomodoro (issue #41).
export const IconPlay = shim(Play, 'fill');
export const IconPause = shim(Pause, 'fill');
