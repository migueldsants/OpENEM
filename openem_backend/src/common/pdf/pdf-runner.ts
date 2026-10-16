/**
 * Fila dos PDFs.
 *
 * Desenhar um caderno é CPU pura e síncrona (MathJax, svg-to-pdfkit, PDFKit):
 * o caderno de fórmulas padrão leva ~6 s. Na thread principal, isso parava a
 * API inteira enquanto durava, para todos os alunos. Aqui cada PDF roda numa
 * worker thread própria, no máximo `concurrency` de uma vez; quem chega com a
 * fila cheia recebe um erro na hora em vez de empilhar trabalho, e uma worker
 * que passa do tempo-limite é encerrada.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { PdfJob, renderPdfJob } from './pdf-job';

export interface PdfRunnerOptions {
  /** PDFs desenhados ao mesmo tempo. */
  concurrency: number;
  /** PDFs esperando vaga; além disso, `PdfQueueFullError`. */
  maxQueue: number;
  /** Tempo máximo de um desenho, em ms; além disso, `PdfTimeoutError`. */
  timeoutMs: number;
}

export const PDF_RUNNER_DEFAULTS: PdfRunnerOptions = {
  concurrency: 1,
  maxQueue: 8,
  timeoutMs: 60_000,
};

/** Teto de memória de cada worker: um PDF patológico morre sozinho. */
const WORKER_MAX_HEAP_MB = 512;

export class PdfQueueFullError extends Error {
  constructor() {
    super('Fila de PDFs cheia');
  }
}

export class PdfTimeoutError extends Error {
  constructor() {
    super('PDF passou do tempo-limite');
  }
}

/** Executa um job e devolve os bytes; o padrão usa uma worker thread. */
export type PdfExecutor = (job: PdfJob, timeoutMs: number) => Promise<Buffer>;

/**
 * Lê a configuração do ambiente. Valor ausente ou inválido cai no padrão, para
 * um erro de digitação não desligar a fila.
 */
export function pdfRunnerOptionsFromEnv(
  env: Record<string, string | undefined>,
): PdfRunnerOptions {
  const inteiro = (raw: string | undefined, min: number, padrao: number) => {
    const n = Number(raw);
    return raw?.trim() && Number.isInteger(n) && n >= min ? n : padrao;
  };
  return {
    concurrency: inteiro(
      env.PDF_CONCURRENCY,
      1,
      PDF_RUNNER_DEFAULTS.concurrency,
    ),
    maxQueue: inteiro(env.PDF_MAX_QUEUE, 0, PDF_RUNNER_DEFAULTS.maxQueue),
    timeoutMs: inteiro(env.PDF_TIMEOUT_MS, 1000, PDF_RUNNER_DEFAULTS.timeoutMs),
  };
}

export class PdfRunner {
  private ativos = 0;
  private readonly esperando: (() => void)[] = [];

  constructor(
    private readonly options: PdfRunnerOptions,
    private readonly executor: PdfExecutor = defaultExecutor(),
  ) {}

  async run(job: PdfJob): Promise<Buffer> {
    await this.vaga();
    try {
      return await this.executor(job, this.options.timeoutMs);
    } finally {
      this.liberar();
    }
  }

  private vaga(): Promise<void> {
    if (this.ativos < this.options.concurrency) {
      this.ativos++;
      return Promise.resolve();
    }
    if (this.esperando.length >= this.options.maxQueue) {
      return Promise.reject(new PdfQueueFullError());
    }
    // A vaga passa direto de quem sai para quem espera: `ativos` não muda.
    return new Promise((resolve) => this.esperando.push(resolve));
  }

  private liberar(): void {
    const proximo = this.esperando.shift();
    if (proximo) proximo();
    else this.ativos--;
  }
}

/**
 * Worker thread quando o build compilado existe (`dist/`, em produção e no
 * `start:dev`). Nos testes, que rodam o TypeScript direto, não há o `.js` da
 * worker: o desenho roda na própria thread, com o mesmo tempo-limite.
 */
function defaultExecutor(): PdfExecutor {
  const arquivo = join(__dirname, 'pdf.worker.js');
  return existsSync(arquivo) ? workerExecutor(arquivo) : inlineExecutor;
}

const inlineExecutor: PdfExecutor = (job, timeoutMs) =>
  withTimeout(renderPdfJob(job), timeoutMs);

/** Rejeita com `PdfTimeoutError` se a promessa não terminar em `ms`. */
export function withTimeout<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PdfTimeoutError()), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

type WorkerReply =
  | { ok: true; pdf: Uint8Array }
  | { ok: false; message: string };

function workerExecutor(arquivo: string): PdfExecutor {
  return (job, timeoutMs) =>
    new Promise<Buffer>((resolve, reject) => {
      const worker = new Worker(arquivo, {
        workerData: job,
        resourceLimits: { maxOldGenerationSizeMb: WORKER_MAX_HEAP_MB },
      });
      let fim = false;
      const terminar = (acao: () => void) => {
        if (fim) return;
        fim = true;
        clearTimeout(timer);
        acao();
        void worker.terminate();
      };
      const timer = setTimeout(
        () => terminar(() => reject(new PdfTimeoutError())),
        timeoutMs,
      );
      worker.once('message', (msg: WorkerReply) =>
        terminar(() =>
          msg.ok
            ? resolve(Buffer.from(msg.pdf))
            : reject(new Error(msg.message)),
        ),
      );
      worker.once('error', (e) => terminar(() => reject(e)));
      worker.once('exit', (code) =>
        terminar(() =>
          reject(new Error(`Worker do PDF saiu com código ${code}`)),
        ),
      );
    });
}
