import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NightPlannerService } from './night-planner.service';
import { NightPlannerController } from './night-planner.controller';
import { GameLibrary } from '../game-library/game-library.entity';
import { Session } from '../session/session.entity';
import { SessionModule } from '../session/session.module';
import { AuthModule } from '../auth/auth.module';

/**
 * The Night Builder. A leaf module that composes the library and session
 * modules to suggest and apply a planned night — no new circular dependencies.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([GameLibrary, Session]),
    SessionModule,
    AuthModule,
  ],
  providers: [NightPlannerService],
  controllers: [NightPlannerController],
  exports: [NightPlannerService],
})
export class NightPlannerModule {}
