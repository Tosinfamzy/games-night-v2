import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayerService } from './player.service';
import { PlayerController } from './player.controller';
import { Player } from './player.entity';
import { Session } from '../session/session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Player, Session]),
    forwardRef(() => require('../session/session.module').SessionModule),
  ],
  providers: [PlayerService],
  controllers: [PlayerController],
  exports: [PlayerService],
})
export class PlayerModule {}
