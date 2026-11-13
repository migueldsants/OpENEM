import type { ComponentProps } from 'react';
import {
  IconBookOpenText,
  IconBrain,
  IconDna,
  IconFeather,
  IconFlask,
  IconGlobe,
  IconMagnet,
  IconMathOperations,
  IconPaintBrush,
  IconPenNib,
  IconRun,
  IconScroll,
  IconTranslate,
  IconUsersThree,
} from './icons';

type Icone = typeof IconFlask;

const ICONES: Record<string, Icone> = {
  matemática: IconMathOperations,
  física: IconMagnet,
  química: IconFlask,
  biologia: IconDna,
  história: IconScroll,
  geografia: IconGlobe,
  filosofia: IconBrain,
  sociologia: IconUsersThree,
  'língua portuguesa': IconBookOpenText,
  literatura: IconFeather,
  'língua estrangeira': IconTranslate,
  artes: IconPaintBrush,
  'educação física': IconRun,
  redação: IconPenNib,
};

/** O ícone de cada matéria da taxonomia; matéria nova cai num livro aberto. */
export function IconeDaMateria({
  nome,
  ...props
}: { nome: string } & ComponentProps<Icone>) {
  const Icone = ICONES[nome.toLowerCase().trim()] ?? IconBookOpenText;
  return <Icone {...props} />;
}
