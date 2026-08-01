import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TeamFormationStrategy } from './team-formation.dto';

/** Body for rebalancing existing teams with a chosen formation strategy. */
export class RebalanceTeamsDto {
  @ApiProperty({
    enum: TeamFormationStrategy,
    required: false,
    description: 'Formation strategy to rebalance with (default: balanced)',
  })
  @IsOptional()
  @IsEnum(TeamFormationStrategy)
  strategy?: TeamFormationStrategy;
}
