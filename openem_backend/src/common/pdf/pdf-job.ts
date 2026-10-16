/**
 * O que um PDF precisa para ser desenhado, num formato que atravessa a
 * fronteira de uma worker thread (dados puros, sem Prisma nem classes).
 */

import {
  FormulaPdfItem,
  formulasPdfBuffer,
  FormulasPdfOptions,
} from './formulas-pdf';
import { PdfOptions, PdfQuestion, simuladoPdfBuffer } from './simulado-pdf';

export type PdfJob =
  | { kind: 'simulado'; questions: PdfQuestion[]; options: PdfOptions }
  | { kind: 'formulas'; items: FormulaPdfItem[]; options: FormulasPdfOptions };

/** Desenha o PDF na thread em que for chamado (a worker ou, sem ela, a principal). */
export function renderPdfJob(job: PdfJob): Promise<Buffer> {
  return job.kind === 'simulado'
    ? simuladoPdfBuffer(job.questions, job.options)
    : formulasPdfBuffer(job.items, job.options);
}
