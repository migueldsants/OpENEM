import { Module } from '@nestjs/common';
import { PdfRenderService } from './pdf-render.service';

/** Fila única de PDFs, compartilhada por simulados e fórmulas. */
@Module({
  providers: [PdfRenderService],
  exports: [PdfRenderService],
})
export class PdfModule {}
