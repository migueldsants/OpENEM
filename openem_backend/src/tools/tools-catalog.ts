/**
 * Ferramentas abertas que complementam o OpENEM (tela Ferramentas). É também
 * a lista do que o servidor aceita consultar no GitHub: a contagem de
 * estrelas só é buscada para repositórios daqui, então a rota não vira um
 * proxy para qualquer repositório. Para incluir outra, acrescente uma entrada.
 */
export interface Tool {
  name: string;
  /** `dono/repositório` no GitHub. */
  repo: string;
  description: string;
  /** Rótulos curtos: o que é e a licença. */
  tags: string[];
}

export const TOOLS: Tool[] = [
  {
    name: 'Corretor de redação do Enem',
    repo: 'migueldsants/AI-Skill-Corretor-Redacao-ENEM',
    description:
      'Skill para agentes de IA que corrige a redação pela Matriz de Referência oficial do Inep: nota de 0 a 200 em cada uma das cinco competências, com o descritor oficial citado em cada nota. Cole a redação e o tema em qualquer chat de IA com a skill instalada.',
    tags: ['Skill de IA', 'MIT'],
  },
  {
    name: 'API ENEM (atualizada)',
    repo: 'migueldsants/updated-enem-api',
    description:
      'Provas e questões oficiais do ENEM em formato aberto, com as edições e reaplicações mais recentes. É a base do banco de questões do OpENEM.',
    tags: ['Dados e API', 'GPL-2.0'],
  },
];

export function githubUrl(repo: string): string {
  return `https://github.com/${repo}`;
}
