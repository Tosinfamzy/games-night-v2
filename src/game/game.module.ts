import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameService } from './game.service';
import { GameController } from './game.controller';
import { Game } from './game.entity';
import { Session } from '../session/session.entity';
import { Team } from '../team/team.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Game, Session, Team])],
  providers: [GameService],
  controllers: [GameController],
  exports: [GameService],
})
export class GameModule {}
