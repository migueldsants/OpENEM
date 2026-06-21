// Ícones do app — Phosphor (pesos regular/bold/fill/duotone), expostos sob os
// nomes usados na base. O shim traduz a API antiga (width/height/filled) para a
// do Phosphor (size/weight), então os call sites seguem funcionando.
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Check,
  Clock,
  Exam,
  Flame,
  House,
  type Icon as PhosphorIcon,
  type IconProps,
  Lightning,
  LockSimple,
  Moon,
  NotePencil,
  SignOut,
  SlidersHorizontal,
  Star,
  Sun,
  Trophy,
  User,
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
export const IconCheck = shim(Check, 'bold');
export const IconX = shim(X, 'bold');
export const IconChevronLeft = shim(CaretLeft, 'bold');
export const IconChevronRight = shim(CaretRight, 'bold');
export const IconFilter = shim(SlidersHorizontal, 'bold');
export const IconFlame = shim(Flame, 'fill');
export const IconBolt = shim(Lightning, 'fill');
export const IconLock = shim(LockSimple, 'regular');
export const IconLogout = shim(SignOut, 'bold');
export const IconSun = shim(Sun, 'bold');
export const IconMoon = shim(Moon, 'fill');
export const IconClock = shim(Clock, 'regular');
