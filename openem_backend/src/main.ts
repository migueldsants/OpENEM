import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('OpENEM - API de Estudos')
   .setDescription(
      'Documentação da API da plataforma OpENEM, abrangendo ferramentas de estudo, ' +
      'gestão de conteúdos, simulados, métricas de desempenho, etc.'
    )
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();