/**
 * Ferramentas abertas que complementam o OpENEM, mostradas na tela
 * Ferramentas. Para incluir outra, acrescente uma entrada aqui.
 */
export interface Ferramenta {
  /** Nome de exibição. */
  nome: string;
  /** `dono/repositório` no GitHub. */
  repo: string;
  descricao: string;
  /** Rótulos curtos: o que é e a licença. */
  rotulos: string[];
}

export const FERRAMENTAS: Ferramenta[] = [
  {
    nome: 'Corretor de redação do Enem',
    repo: 'migueldsants/AI-Skill-Corretor-Redacao-ENEM',
    descricao:
      'Skill para agentes de IA que corrige a redação pela Matriz de Referência oficial do Inep: nota de 0 a 200 em cada uma das cinco competências, com o descritor oficial citado em cada nota. Cole a redação e o tema em qualquer chat de IA com a skill instalada.',
    rotulos: ['Skill de IA', 'MIT'],
  },
  {
    nome: 'API ENEM (atualizada)',
    repo: 'migueldsants/updated-enem-api',
    descricao:
      'Provas e questões oficiais do ENEM em formato aberto, com as edições e reaplicações mais recentes. É a base do banco de questões do OpENEM.',
    rotulos: ['Dados e API', 'GPL-2.0'],
  },
];

export function githubUrl(repo: string): string {
  return `https://github.com/${repo}`;
}
