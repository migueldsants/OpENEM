import { Module } from '@nestjs/common';
import { PdfModule } from '../common/pdf/pdf.module';
import { FormulasService } from './formulas.service';
import { FormulasController } from './formulas.controller';

@Module({
  imports: [PdfModule],
  providers: [FormulasService],
  controllers: [FormulasController],
})
export class FormulasModule {}
