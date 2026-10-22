/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Endereço do app (padrão `/app/`; no dev, o Vite do app em :5173). */
  readonly VITE_APP_URL?: string;
}

declare module 'virtual:arquivo-redacoes' {
  const temas: { ano: number; aplicacao: string; rotulo: string; tema: string }[];
  export default temas;
}
