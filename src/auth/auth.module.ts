import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { WsPlayerAuthGuard } from './guards/ws-player-auth.guard';
import { UserModule } from '../user/user.module';
import { GamesMasterModule } from '../games-master/games-master.module';

@Module({
  imports: [
    ConfigModule,
    UserModule,
    GamesMasterModule,
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
  providers: [AuthService, JwtStrategy, WsPlayerAuthGuard],
  exports: [AuthService, JwtStrategy, PassportModule, WsPlayerAuthGuard],
})
export class AuthModule {}
