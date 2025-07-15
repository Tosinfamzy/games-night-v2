import { ApiProperty } from '@nestjs/swagger';

export class CreateGamesMasterDto {
  @ApiProperty({ example: 'Alice', description: 'Name of the games master' })
  name: string;
}
