import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistoryService } from './history.service';
import { HistoryController } from './history.controller';
import { GameResult } from './game-result.entity';
import { Game } from '../game/game.entity';
import { Session } from '../session/session.entity';
import { Team } from '../team/team.entity';
import { Player } from '../player/player.entity';
import { Score } from '../score/score.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([GameResult, Game, Session, Team, Player, Score]),
  ],
  providers: [HistoryService],
  controllers: [HistoryController],
  exports: [HistoryService],
})
export class HistoryModule {}
