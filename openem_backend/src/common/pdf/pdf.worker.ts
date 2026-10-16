/**
 * Worker thread que desenha um PDF. Recebe o `PdfJob` em `workerData`, devolve
 * os bytes por mensagem e encerra: uma worker por PDF, para a memória do
 * desenho voltar inteira ao sistema e o tempo-limite poder matá-la.
 */

import { parentPort, workerData } from 'node:worker_threads';
import { PdfJob, renderPdfJob } from './pdf-job';

renderPdfJob(workerData as PdfJob).then(
  (pdf) => parentPort?.postMessage({ ok: true, pdf }),
  (e: unknown) =>
    parentPort?.postMessage({
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    }),
);
