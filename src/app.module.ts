import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { createKeyv } from '@keyv/redis';
import { GamesMasterModule } from './games-master/games-master.module';
import { SessionModule } from './session/session.module';
import { PlayerModule } from './player/player.module';
import { GameModule } from './game/game.module';
import { TeamModule } from './team/team.module';
import { ScoreModule } from './score/score.module';
import { GameLibraryModule } from './game-library/game-library.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { HistoryModule } from './history/history.module';
import { HealthModule } from './health/health.module';
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3000),
        DB_HOST: Joi.string().default('localhost'),
        DB_PORT: Joi.number().default(5432),
        DB_USER: Joi.string().default('postgres'),
        DB_PASSWORD: Joi.string().required(),
        DB_NAME: Joi.string().default('games_night'),
        DB_SYNCHRONIZE: Joi.string().valid('true', 'false').optional(),
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().optional(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get('NODE_ENV') === 'production';
        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT'),
          username: configService.get<string>('DB_USER'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_NAME'),
          entities: [__dirname + '/**/*.entity.{ts,js}'],
          migrations: [__dirname + '/migrations/*.{ts,js}'],
          migrationsTableName: 'migrations',
          // Production: never auto-sync the schema; apply migrations on boot.
          // Dev/test: synchronize for fast iteration (opt out with DB_SYNCHRONIZE=false).
          synchronize:
            !isProduction && configService.get('DB_SYNCHRONIZE') !== 'false',
          migrationsRun: isProduction,
        };
      },
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST');
        const port = configService.get<number>('REDIS_PORT');
        const password = configService.get<string>('REDIS_PASSWORD');
        const auth = password ? `:${encodeURIComponent(password)}@` : '';
        const url = `redis://${auth}${host}:${port}`;
        return {
          // cache-manager v7 is Keyv-based; @keyv/redis replaces the
          // deprecated cache-manager-redis-store. TTL is in milliseconds.
          stores: [createKeyv(url)],
          ttl: 60 * 60 * 1000, // 1 hour
        };
      },
      inject: [ConfigService],
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60, // 1 minute
        limit: 10, // 10 requests per minute
      },
    ]),
    EventEmitterModule.forRoot(),
    GamesMasterModule,
    SessionModule,
    PlayerModule,
    GameModule,
    TeamModule,
    ScoreModule,
    GameLibraryModule,
    UserModule,
    AuthModule,
    ChatModule,
    HistoryModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
