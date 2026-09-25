// O pacote não traz tipos. Só o que o caderno de fórmulas usa.
declare module 'svg-to-pdfkit' {
  interface SvgToPdfOptions {
    width?: number;
    height?: number;
    preserveAspectRatio?: string;
    /** Trata unidades sem sufixo como pontos (e não pixels). */
    assumePt?: boolean;
  }
  function SVGtoPDF(
    doc: PDFKit.PDFDocument,
    svg: string,
    x: number,
    y: number,
    options?: SvgToPdfOptions,
  ): void;
  export = SVGtoPDF;
}
