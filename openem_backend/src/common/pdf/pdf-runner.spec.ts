import { PdfJob } from './pdf-job';
import {
  PDF_RUNNER_DEFAULTS,
  PdfExecutor,
  PdfQueueFullError,
  PdfRunner,
  pdfRunnerOptionsFromEnv,
  PdfTimeoutError,
  withTimeout,
} from './pdf-runner';

const job: PdfJob = { kind: 'formulas', items: [], options: { title: 't' } };

/** Executor controlado à mão: cada chamada fica pendente até `concluir`. */
function executorManual() {
  const pendentes: { resolve: (b: Buffer) => void; job: PdfJob }[] = [];
  const executor: PdfExecutor = (j) =>
    new Promise((resolve) => pendentes.push({ resolve, job: j }));
  return {
    executor,
    pendentes,
    concluir: (i = 0) => pendentes.splice(i, 1)[0].resolve(Buffer.from('pdf')),
  };
}

const tick = () => new Promise((r) => setImmediate(r));

describe('PdfRunner', () => {
  it('desenha no máximo `concurrency` PDFs ao mesmo tempo', async () => {
    const m = executorManual();
    const runner = new PdfRunner(
      { concurrency: 2, maxQueue: 5, timeoutMs: 1000 },
      m.executor,
    );
    const resultados = [1, 2, 3, 4].map(() => runner.run(job));
    await tick();
    expect(m.pendentes).toHaveLength(2);

    m.concluir();
    await tick();
    // A vaga liberada vai para o próximo da fila.
    expect(m.pendentes).toHaveLength(2);

    m.concluir();
    m.concluir();
    await tick();
    expect(m.pendentes).toHaveLength(1);
    m.concluir();
    await expect(Promise.all(resultados)).resolves.toHaveLength(4);
  });

  it('recusa na hora quando a fila de espera está cheia', async () => {
    const m = executorManual();
    const runner = new PdfRunner(
      { concurrency: 1, maxQueue: 1, timeoutMs: 1000 },
      m.executor,
    );
    const primeiro = runner.run(job);
    const segundo = runner.run(job);
    await expect(runner.run(job)).rejects.toBeInstanceOf(PdfQueueFullError);

    m.concluir();
    await tick();
    m.concluir();
    await expect(Promise.all([primeiro, segundo])).resolves.toHaveLength(2);
  });

  it('libera a vaga quando o desenho falha', async () => {
    let chamadas = 0;
    const runner = new PdfRunner(
      { concurrency: 1, maxQueue: 0, timeoutMs: 1000 },
      () => {
        chamadas++;
        return chamadas === 1
          ? Promise.reject(new Error('quebrou'))
          : Promise.resolve(Buffer.from('ok'));
      },
    );
    await expect(runner.run(job)).rejects.toThrow('quebrou');
    await expect(runner.run(job)).resolves.toEqual(Buffer.from('ok'));
  });

  it('passa o job e o tempo-limite para o executor', async () => {
    const executor = jest.fn().mockResolvedValue(Buffer.from('ok'));
    const runner = new PdfRunner(
      { concurrency: 1, maxQueue: 0, timeoutMs: 4321 },
      executor,
    );
    await runner.run(job);
    expect(executor).toHaveBeenCalledWith(job, 4321);
  });

  it('sem worker compilada, desenha na própria thread e devolve um PDF', async () => {
    const runner = new PdfRunner({ ...PDF_RUNNER_DEFAULTS });
    const pdf = await runner.run({
      kind: 'formulas',
      items: [
        {
          title: 'Pitágoras',
          latex: 'a^2 + b^2 = c^2',
          description: null,
          subjectName: 'Matemática',
          topicName: null,
          symbols: [],
        },
      ],
      options: { title: 'Teste', cover: false, toc: false },
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('withTimeout', () => {
  it('rejeita quando a promessa não termina no prazo', async () => {
    await expect(withTimeout(new Promise(() => {}), 5)).rejects.toBeInstanceOf(
      PdfTimeoutError,
    );
  });

  it('devolve o resultado quando termina antes', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000)).resolves.toBe(42);
  });

  it('repassa o erro original', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('original')), 1000),
    ).rejects.toThrow('original');
  });
});

describe('pdfRunnerOptionsFromEnv', () => {
  it('sem variáveis, usa o padrão', () => {
    expect(pdfRunnerOptionsFromEnv({})).toEqual(PDF_RUNNER_DEFAULTS);
  });

  it('lê números válidos', () => {
    expect(
      pdfRunnerOptionsFromEnv({
        PDF_CONCURRENCY: '2',
        PDF_MAX_QUEUE: '0',
        PDF_TIMEOUT_MS: '30000',
      }),
    ).toEqual({ concurrency: 2, maxQueue: 0, timeoutMs: 30_000 });
  });

  it('valor inválido ou abaixo do mínimo cai no padrão', () => {
    expect(
      pdfRunnerOptionsFromEnv({
        PDF_CONCURRENCY: '0',
        PDF_MAX_QUEUE: 'muitos',
        PDF_TIMEOUT_MS: '10',
      }),
    ).toEqual(PDF_RUNNER_DEFAULTS);
    expect(pdfRunnerOptionsFromEnv({ PDF_CONCURRENCY: ' ' })).toEqual(
      PDF_RUNNER_DEFAULTS,
    );
    expect(pdfRunnerOptionsFromEnv({ PDF_CONCURRENCY: '1.5' })).toEqual(
      PDF_RUNNER_DEFAULTS,
    );
  });
});
