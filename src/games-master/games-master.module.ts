import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GamesMasterService } from './games-master.service';
import { GamesMasterController } from './games-master.controller';
import { GamesMaster } from './games-master.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GamesMaster])],
  providers: [GamesMasterService],
  controllers: [GamesMasterController],
})
export class GamesMasterModule {}
