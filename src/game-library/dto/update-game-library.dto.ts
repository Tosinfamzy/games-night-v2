import { PartialType } from '@nestjs/swagger';
import { CreateGameLibraryDto } from './create-game-library.dto';

export class UpdateGameLibraryDto extends PartialType(CreateGameLibraryDto) {}
