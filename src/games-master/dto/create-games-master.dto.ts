import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateGamesMasterDto {
  @ApiProperty({ example: 'Alice', description: 'Name of the games master' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
