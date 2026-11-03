/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Endereço do app (padrão `/app/`; no dev, o Vite do app em :5173). */
  readonly VITE_APP_URL?: string;
  /** Patrocínio do projeto (padrão: o GitHub Sponsors do mantenedor). */
  readonly VITE_SPONSOR_URL?: string;
}

declare module 'virtual:tabela-periodica' {
  const dados: import('./landing/tabela-dados').DadosDaPrevia;
  export default dados;
}

declare module 'virtual:arquivo-redacoes' {
  const temas: { ano: number; aplicacao: string; rotulo: string; tema: string }[];
  export default temas;
}
