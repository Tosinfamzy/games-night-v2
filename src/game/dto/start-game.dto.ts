import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class StartGameDto {
  @ApiProperty({
    description: 'Array of team IDs participating in the game',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  teamIds: string[];
}
