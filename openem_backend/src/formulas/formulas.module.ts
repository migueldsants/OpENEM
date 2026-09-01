import { Module } from '@nestjs/common';
import { FormulasService } from './formulas.service';
import { FormulasController } from './formulas.controller';

@Module({
  providers: [FormulasService],
  controllers: [FormulasController],
})
export class FormulasModule {}
