import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import { simuladoPdfBuffer } from '../common/pdf/simulado-pdf';
import { SimulationPdfDto } from './dto/simulation-pdf.dto';
import { SimulationsService } from './simulations.service';

/**
 * Gera o caderno em PDF. A montagem das questões é do `SimulationsService` (é
 * o mesmo recorte que o simulado da tela usa) e o desenho é do
 * `common/pdf/simulado-pdf`; aqui ficam só a configuração de ambiente e o nome
 * do arquivo que o aluno recebe.
 */
@Injectable()
export class SimulationPdfService {
  constructor(
    private readonly simulations: SimulationsService,
    private readonly config: ConfigService,
  ) {}

  /** Onde as imagens das questões vivem (mesma variável que serve /media/enem). */
  private mediaDir(): string {
    return (
      this.config.get<string>('ENEM_MEDIA_DIR') ??
      join(process.cwd(), 'public', 'enem')
    );
  }

  async generate(
    userId: string,
    dto: SimulationPdfDto,
    simulationId?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { questions, title, subtitle, timeLimitMin } =
      await this.simulations.pdfData(userId, dto, simulationId);

    const buffer = await simuladoPdfBuffer(questions, {
      title,
      subtitle,
      timeLimitMin,
      theme: dto.theme,
      brandColor: dto.brandColor,
      cover: dto.cover !== false,
      answerSheet: dto.answerSheet !== false,
      answerKey: dto.answerKey !== false,
      explanations: dto.explanations === true,
      twoColumns: dto.twoColumns !== false,
      studentName: dto.studentName ?? null,
      mediaDir: this.mediaDir(),
    });

    return { buffer, filename: pdfFilename(title) };
  }
}

/**
 * Nome do arquivo baixado: "openem-simulado-enem-2023-1o-dia.pdf". Só ASCII —
 * acento em `Content-Disposition` chega quebrado em parte dos navegadores.
 */
export function pdfFilename(title: string): string {
  const base = title
    // º e ª não são acento: o NFD não os decompõe, e sem esta troca
    // "1º dia" viraria "1-dia".
    .replace(/º/g, 'o')
    .replace(/ª/g, 'a')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `openem-${base || 'simulado'}.pdf`;
}
