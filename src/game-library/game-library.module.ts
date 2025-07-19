import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameLibraryService } from './game-library.service';
import { GameLibraryController } from './game-library.controller';
import { GameLibrary } from './game-library.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GameLibrary])],
  controllers: [GameLibraryController],
  providers: [GameLibraryService],
  exports: [GameLibraryService],
})
export class GameLibraryModule {}
