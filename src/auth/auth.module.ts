import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { WsPlayerAuthGuard } from './guards/ws-player-auth.guard';
import { HostGuard } from './guards/host.guard';
import { HostAuthzService } from './host-authz.service';
import { UserModule } from '../user/user.module';
import { GamesMasterModule } from '../games-master/games-master.module';
import { Session } from '../session/session.entity';
import { Game } from '../game/game.entity';
import { Score } from '../score/score.entity';
import { Player } from '../player/player.entity';

@Module({
  imports: [
    ConfigModule,
    UserModule,
    GamesMasterModule,
    // Repos the HostGuard needs to resolve a route's session + host player.
    TypeOrmModule.forFeature([Session, Game, Score, Player]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret =
          configService.get<string>('JWT_SECRET') || 'default-secret';
        return {
          secret,
          signOptions: {},
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    WsPlayerAuthGuard,
    HostAuthzService,
    HostGuard,
  ],
  exports: [
    AuthService,
    JwtStrategy,
    PassportModule,
    WsPlayerAuthGuard,
    HostAuthzService,
    HostGuard,
  ],
})
export class AuthModule {}
