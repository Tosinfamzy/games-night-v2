import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScoreService } from './score.service';
import { ScoreController } from './score.controller';
import { Score } from './score.entity';
import { Game } from '../game/game.entity';
import { Team } from '../team/team.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Score, Game, Team]),
    EventEmitterModule.forRoot(),
  ],
  providers: [ScoreService],
  controllers: [ScoreController],
  exports: [ScoreService],
})
export class ScoreModule {}
