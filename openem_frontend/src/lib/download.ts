/** Dispara o download no navegador a partir de um blob (PDF gerado na API). */
export function baixarArquivo(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoga depois do clique: revogar na hora cancela o download no Safari.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
