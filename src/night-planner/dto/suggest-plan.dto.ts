import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsInt, IsUUID, Min } from 'class-validator';

/**
 * Query params for a plan suggestion. `gameLibraryIds` accepts either a
 * repeated query param (`?gameLibraryIds=a&gameLibraryIds=b`) or a single
 * comma-separated value (`?gameLibraryIds=a,b`).
 */
export class SuggestPlanDto {
  @ApiProperty({
    example: 20,
    description: 'Expected number of players (drives team split + warnings)',
    minimum: 0,
  })
  @Transform(({ value }) => Number.parseInt(String(value), 10))
  @IsInt()
  @Min(0)
  playerCount: number;

  @ApiProperty({
    type: [String],
    description: 'Library IDs of the games being considered',
  })
  @Transform(({ value }): string[] =>
    Array.isArray(value)
      ? (value as string[])
      : String(value)
          .split(',')
          .filter((id) => id.length > 0),
  )
  @IsArray()
  @IsUUID('all', { each: true })
  gameLibraryIds: string[];
}
