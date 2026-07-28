import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GamesMasterService } from './games-master.service';
import { GamesMaster } from './games-master.entity';

// The GamesMaster HTTP controller was removed: it was unauthenticated (anyone
// could enumerate host codes and update/delete any host) and entirely unused by
// the frontend, which now uses Clerk + /auth/games-master. The service stays.
@Module({
  imports: [TypeOrmModule.forFeature([GamesMaster])],
  providers: [GamesMasterService],
  exports: [GamesMasterService],
})
export class GamesMasterModule {}
