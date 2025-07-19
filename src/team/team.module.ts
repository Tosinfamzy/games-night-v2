import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';
import { Team } from './team.entity';
import { Game } from '../game/game.entity';
import { Session } from '../session/session.entity';
import { Player } from '../player/player.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Team, Game, Session, Player])],
  providers: [TeamService],
  controllers: [TeamController],
  exports: [TeamService],
})
export class TeamModule {}
