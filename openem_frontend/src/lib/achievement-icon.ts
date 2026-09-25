// Resolve a chave de ícone que a API manda para um ícone vetorial.
//
// O catálogo de conquistas (`common/gamification.ts`) e os decks de flashcards
// guardavam um emoji nesse campo. Emoji depende da fonte do sistema: muda de
// desenho entre Windows, Android e iOS, ignora a cor da marca e desalinha ao
// lado do texto. Agora o backend manda um nome ('flame', 'crown', 'dna'…) e a
// escolha do desenho é do front.
import { createElement } from 'react';
import {
  IconBolt,
  IconBook,
  IconBooks,
  IconCalculator,
  IconClipboard,
  IconCrown,
  IconDna,
  IconFlame,
  IconFlask,
  IconGlobe,
  IconMedal,
  IconMedalMilitary,
  IconNote,
  IconPenNib,
  IconRepeat,
  IconRun,
  IconScroll,
  IconSparkle,
  IconStack,
  IconStar,
  IconTarget,
  IconTimer,
  IconTrophy,
} from '../components/icons';

type IconComponent = typeof IconTrophy;

const ICONS: Record<string, IconComponent> = {
  // Conquistas (issue #48).
  pencil: IconNote,
  target: IconTarget,
  exam: IconStack,
  flame: IconFlame,
  trophy: IconTrophy,
  star: IconStar,
  sparkle: IconSparkle,
  crown: IconCrown,
  clipboard: IconClipboard,
  medal: IconMedal,
  'medal-military': IconMedalMilitary,
  'pen-nib': IconPenNib,
  repeat: IconRepeat,
  books: IconBooks,
  timer: IconTimer,
  run: IconRun,
  // Matérias dos decks de flashcards.
  dna: IconDna,
  lightning: IconBolt,
  globe: IconGlobe,
  scroll: IconScroll,
  book: IconBook,
  calculator: IconCalculator,
  flask: IconFlask,
};

/**
 * Ícone da chave, ou o troféu quando a chave é desconhecida — bancos semeados
 * antes desta mudança ainda têm emoji gravado, e decks criados pelo usuário
 * podem trazer qualquer coisa.
 */
export function iconForName(name: string | null | undefined): IconComponent {
  return (name && ICONS[name]) || IconTrophy;
}

/**
 * Renderiza o ícone da chave. Via `createElement` de propósito: atribuir o
 * componente resolvido a uma variável maiúscula dentro do render faz o lint do
 * React Compiler acusar criação de componente em tempo de render.
 */
export function AchievementIcon({
  name,
  size = 22,
}: {
  name: string | null | undefined;
  size?: number;
}) {
  return createElement(iconForName(name), { width: size, height: size });
}
