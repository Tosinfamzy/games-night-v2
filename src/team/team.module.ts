import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamService } from './team.service';
import { TeamFormationService } from './services/team-formation.service';
import { TeamAssignmentService } from './services/team-assignment.service';
import { TeamController } from './team.controller';
import { Team } from './team.entity';
import { Game } from '../game/game.entity';
import { Session } from '../session/session.entity';
import { Player } from '../player/player.entity';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Team, Game, Session, Player]),
    forwardRef(() => SessionModule),
  ],
  providers: [TeamService, TeamFormationService, TeamAssignmentService],
  controllers: [TeamController],
  exports: [TeamService, TeamFormationService, TeamAssignmentService],
})
export class TeamModule {}
