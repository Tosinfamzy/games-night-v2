import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsNumber, Min, IsEnum } from 'class-validator';
import { TeamFormationStrategy } from '../../team/dto/team-formation.dto';

export class StartGameWithTeamsDto {
  @ApiProperty({
    description: 'Number of teams to create',
    example: 2,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(2)
  teamCount: number;

  @ApiProperty({
    description: 'Team formation strategy',
    enum: TeamFormationStrategy,
    example: TeamFormationStrategy.AUTOMATIC,
  })
  @IsEnum(TeamFormationStrategy)
  strategy: TeamFormationStrategy;

  @ApiProperty({
    description: 'Turn time limit in seconds',
    example: 120,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(10)
  turnTimeLimit?: number;
}
