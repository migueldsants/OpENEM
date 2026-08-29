import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Hooks de shutdown (issue #49): limpa recursos do Prisma/Throttler no SIGTERM.
  app.enableShutdownHooks();

  // Headers de segurança (issue #49): helmet com CSP compatível com o frontend
  // (Swagger UI precisa de scripts inline no /api).
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS explícito (issue #49): credenciais off; em dev o Vite proxy encaminha
  // mesmas origens, então basta liberar a origem do preview/build de produção.
  const corsOrigins = process.env.CORS_ORIGINS;
  if (corsOrigins) {
    app.enableCors({
      origin: corsOrigins.split(',').map((o) => o.trim()),
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    });
  } else {
    app.enableCors();
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Endpoints de domínio sob /api/v1; raiz e /health ficam fora do prefixo.
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: '', method: RequestMethod.GET },
      { path: 'health', method: RequestMethod.GET },
    ],
  });

  // Swagger apenas fora de produção (issue #49).
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('OpENEM - API de Estudos')
      .setDescription(
        'Documentação da API da plataforma OpENEM, abrangendo ferramentas de estudo, ' +
          'gestão de conteúdos, simulados, métricas de desempenho, etc.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, documentFactory);
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
