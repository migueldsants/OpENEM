import {
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PdfJob } from './pdf-job';
import {
  PdfQueueFullError,
  PdfRunner,
  pdfRunnerOptionsFromEnv,
  PdfTimeoutError,
} from './pdf-runner';

/**
 * Limite das rotas que geram PDF, por IP. O global (100/min por rota) deixava
 * um só aluno pedir mais PDFs do que o servidor desenha num minuto.
 */
export const PDF_THROTTLE = { default: { ttl: 60_000, limit: 10 } };

/**
 * Porta de entrada dos PDFs para os módulos (simulados e fórmulas). Uma
 * instância só no processo: a fila é uma para a API inteira.
 */
@Injectable()
export class PdfRenderService {
  private readonly logger = new Logger(PdfRenderService.name);

  // Na aplicação o Nest não tem PdfRunner para injetar e passa undefined: vale
  // a fila configurada pelo ambiente. Os testes passam a deles.
  constructor(
    @Optional()
    private readonly runner: PdfRunner = new PdfRunner(
      pdfRunnerOptionsFromEnv(process.env),
    ),
  ) {}

  async render(job: PdfJob): Promise<Buffer> {
    try {
      return await this.runner.run(job);
    } catch (e) {
      if (e instanceof PdfQueueFullError) {
        throw new ServiceUnavailableException(
          'Muitos PDFs sendo gerados agora. Tente de novo em alguns segundos.',
        );
      }
      if (e instanceof PdfTimeoutError) {
        this.logger.warn(`PDF ${job.kind} passou do tempo-limite`);
        throw new ServiceUnavailableException(
          'O PDF ficou grande demais para gerar agora. Escolha menos itens.',
        );
      }
      throw e;
    }
  }
}
