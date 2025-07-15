import { PartialType } from '@nestjs/swagger';
import { CreateGamesMasterDto } from './create-games-master.dto';

export class UpdateGamesMasterDto extends PartialType(CreateGamesMasterDto) {}
