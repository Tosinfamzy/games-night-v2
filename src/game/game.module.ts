import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameService } from './game.service';
import { GameController } from './game.controller';
import { GameGateway } from './game.gateway';
import { GameTimerService } from './game-timer.service';
import { Game } from './game.entity';
import { Session } from '../session/session.entity';
import { Team } from '../team/team.entity';
import { Player } from '../player/player.entity';
import { TeamModule } from '../team/team.module';
import { ScoreModule } from '../score/score.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game, Session, Team, Player]),
    TeamModule,
    forwardRef(() => ScoreModule),
  ],
  providers: [GameService, GameGateway, GameTimerService],
  controllers: [GameController],
  exports: [GameService, GameGateway, GameTimerService],
})
export class GameModule {}
