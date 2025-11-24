import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { SessionGateway } from './session.gateway';
import { Session } from './session.entity';
import { GamesMaster } from '../games-master/games-master.entity';
import { Game } from '../game/game.entity';
import { GameLibrary } from '../game-library/game-library.entity';
import { Player } from '../player/player.entity';
import { Team } from '../team/team.entity';
import { ScoreModule } from '../score/score.module';
import { AuthModule } from '../auth/auth.module';
import { PlayerModule } from '../player/player.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Session,
      GamesMaster,
      Game,
      GameLibrary,
      Player,
      Team,
    ]),
    forwardRef(() => ScoreModule),
    AuthModule,
    PlayerModule,
  ],
  providers: [SessionService, SessionGateway],
  controllers: [SessionController],
  exports: [SessionService, SessionGateway],
})
export class SessionModule {}
