import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';
import { Team } from './team.entity';
import { Game } from '../game/game.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Team, Game])],
  providers: [TeamService],
  controllers: [TeamController],
})
export class TeamModule {}
