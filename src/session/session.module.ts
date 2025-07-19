import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { Session } from './session.entity';
import { GamesMaster } from '../games-master/games-master.entity';
import { Game } from '../game/game.entity';
import { GameLibrary } from '../game-library/game-library.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, GamesMaster, Game, GameLibrary]),
  ],
  providers: [SessionService],
  controllers: [SessionController],
  exports: [SessionService],
})
export class SessionModule {}
