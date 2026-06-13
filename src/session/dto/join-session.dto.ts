import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

@ApiSchema({ name: 'SessionJoinByCodeDto' })
export class JoinSessionDto {
  @ApiProperty({
    description: '6-digit session join code',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  joinCode: string;

  @ApiProperty({
    description: 'Player name to join with',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  playerName: string;
}
