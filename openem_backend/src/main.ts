import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { API_PREFIX, API_PREFIX_EXCLUDE, openApiConfig } from './openapi';
import { parseTrustProxy } from './common/trust-proxy';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Hooks de shutdown (issue #49): limpa recursos do Prisma/Throttler no SIGTERM.
  app.enableShutdownHooks();

  // Proxy reverso: o rate limiting conta por req.ip, que só é o IP do aluno
  // quando o Express confia no proxy da frente (ver common/trust-proxy).
  const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
  if (trustProxy !== undefined) {
    app.set('trust proxy', trustProxy);
  }

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

  // Imagens das questões oficiais do ENEM, gravadas pelo importador.
  // Servidas pelo próprio backend em vez de apontar para o enem.dev: o app é um
  // PWA offline-first para um público com internet limitada, e imagem de
  // terceiro não é cacheável pelo service worker nem cabe no CSP acima. O
  // caminho fica fora do prefixo `api/v1` por não ser rota do Nest.
  const mediaDir =
    process.env.ENEM_MEDIA_DIR ?? join(__dirname, '..', 'public', 'enem');
  if (!existsSync(mediaDir)) {
    mkdirSync(mediaDir, { recursive: true });
  }
  app.useStaticAssets(mediaDir, {
    prefix: '/media/enem',
    // O nome do arquivo é um UUID: o conteúdo nunca muda sob o mesmo caminho.
    maxAge: '365d',
    immutable: true,
    fallthrough: false,
  });

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
  app.setGlobalPrefix(API_PREFIX, { exclude: API_PREFIX_EXCLUDE });

  // Swagger apenas fora de produção (issue #49).
  if (process.env.NODE_ENV !== 'production') {
    const documentFactory = () =>
      SwaggerModule.createDocument(app, openApiConfig());
    SwaggerModule.setup('api', app, documentFactory);
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
