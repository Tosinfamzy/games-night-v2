import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { Session } from './session.entity';
import { GamesMaster } from '../games-master/games-master.entity';
import { Game } from '../game/game.entity';
import { GameLibrary } from '../game-library/game-library.entity';
import { Player } from '../player/player.entity';
import { Team } from '../team/team.entity';

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
  ],
  providers: [SessionService],
  controllers: [SessionController],
  exports: [SessionService],
})
export class SessionModule {}
