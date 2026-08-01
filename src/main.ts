// Polyfill for Node.js 18 compatibility
import { webcrypto } from 'crypto';
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as unknown as Crypto;
}

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AuthenticatedIoAdapter } from './common/adapters/authenticated-io.adapter';
import { isAllowedOrigin } from './common/config/cors.config';
import { getErrorMessage } from './common/utils/error.util';

// A single unhandled rejection/exception would otherwise terminate the process
// (Node >=15) — on single-replica hosting that drops every connected player at
// once mid-game. Log and stay up; the platform restart policy is the backstop
// for a genuinely fatal state. Registered before bootstrap so early failures
// are covered too.
const processLogger = new Logger('Process');
process.on('unhandledRejection', (reason) => {
  processLogger.error(
    `Unhandled promise rejection: ${getErrorMessage(reason)}`,
  );
});
process.on('uncaughtException', (err) => {
  processLogger.error(`Uncaught exception: ${getErrorMessage(err)}`);
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind Railway's edge, the socket peer is a rotating internal proxy IP, so
  // without this the rate limiter can't key per client. Trust the forwarding
  // chain so req.ip resolves to the original client from X-Forwarded-For.
  app.set('trust proxy', true);

  // Authenticate the Socket.IO handshake so socket.data.player is populated at
  // connect time (NestJS @UseGuards only runs on @SubscribeMessage handlers).
  app.useWebSocketAdapter(new AuthenticatedIoAdapter(app));

  // Enable validation pipe globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip non-whitelisted properties
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Enable implicit type conversion
      },
    }),
  );

  // Enable versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Enable CORS — same allowlist as the WebSocket layer (cors.config.ts).
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      callback(null, isAllowedOrigin(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Games Night API')
    .setDescription(
      'API for managing games night sessions, teams, players, and scores',
    )
    .setVersion('1.0')
    .addTag('games-master', 'Games Master operations')
    .addTag('session', 'Game Session operations')
    .addTag('player', 'Player operations')
    .addTag('team', 'Team operations')
    .addTag('game', 'Game operations')
    .addTag('score', 'Score operations')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, swaggerDocument);

  // Clean shutdown on SIGTERM (Railway redeploys): drains the DB pool and runs
  // onModuleDestroy hooks (e.g. GameTimerService clears its interval timers).
  app.enableShutdownHooks();

  // Start the server
  const port = process.env.PORT || 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`Application is running on port ${port}`);
}

void bootstrap().catch((err) => {
  new Logger('Bootstrap').error(
    `Failed to start application: ${getErrorMessage(err)}`,
  );
  process.exit(1);
});
