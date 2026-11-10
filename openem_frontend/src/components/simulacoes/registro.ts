/**
 * Componente de cada simulação, carregado sob demanda: as 3D trazem o
 * three.js, que só baixa quando o aluno abre uma delas. As chaves são os
 * slugs do catálogo (`lib/simulacoes/catalogo.ts`); um teste cobra que os
 * dois andem juntos.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export const REGISTRO: Record<string, LazyExoticComponent<ComponentType>> = {
  'lancamento-obliquo': lazy(() => import('./sims/Lancamento')),
  pendulo: lazy(() => import('./sims/Pendulo')),
  'massa-mola': lazy(() => import('./sims/MassaMola')),
  'plano-inclinado': lazy(() => import('./sims/PlanoInclinado')),
  empuxo: lazy(() => import('./sims/Empuxo')),
  circuitos: lazy(() => import('./sims/Circuitos')),
  'laboratorio-circuitos': lazy(() => import('./sims/LaboratorioCircuitos')),
  refracao: lazy(() => import('./sims/Refracao')),
  'lentes-espelhos': lazy(() => import('./sims/Lentes')),
  doppler: lazy(() => import('./sims/Doppler')),
  interferencia: lazy(() => import('./sims/Interferencia')),
  orbitas: lazy(() => import('./sims/Orbitas')),
  'campo-magnetico': lazy(() => import('./sims/CampoMagnetico')),
  vetores: lazy(() => import('./sims/Vetores')),
  gases: lazy(() => import('./sims/Gases')),
  titulacao: lazy(() => import('./sims/Titulacao')),
  'equilibrio-quimico': lazy(() => import('./sims/Equilibrio')),
  'geometria-molecular': lazy(() => import('./sims/GeometriaMolecular')),
  cristais: lazy(() => import('./sims/Cristais')),
  isomeria: lazy(() => import('./sims/Isomeria')),
  atomo: lazy(() => import('./sims/Atomo')),
  ligacoes: lazy(() => import('./sims/Ligacoes')),
  pilha: lazy(() => import('./sims/Pilha')),
  'decaimento-radioativo': lazy(() => import('./sims/Decaimento')),
  'atomo-hidrogenio': lazy(() => import('./sims/Hidrogenio')),
  'predador-presa': lazy(() => import('./sims/PredadorPresa')),
  'genetica-populacoes': lazy(() => import('./sims/Genetica')),
  dna: lazy(() => import('./sims/DNA')),
  punnett: lazy(() => import('./sims/Punnett')),
  funcoes: lazy(() => import('./sims/Funcoes')),
  'ciclo-trigonometrico': lazy(() => import('./sims/CicloTrigonometrico')),
  triangulos: lazy(() => import('./sims/Triangulos')),
  probabilidade: lazy(() => import('./sims/Probabilidade')),
  'projecoes-ortograficas': lazy(() => import('./sims/Projecoes')),
  planificacao: lazy(() => import('./sims/Planificacao')),
  'estacoes-do-ano': lazy(() => import('./sims/Estacoes')),
  'fases-da-lua': lazy(() => import('./sims/FasesLua')),
  'fusos-horarios': lazy(() => import('./sims/FusosHorarios')),
};
