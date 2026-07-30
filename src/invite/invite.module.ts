import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invite } from './invite.entity';
import { Session } from '../session/session.entity';
import { InviteService } from './invite.service';
import { InviteController } from './invite.controller';
import { AuthModule } from '../auth/auth.module';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invite, Session]),
    AuthModule,
    // For join-via-invite: reuse SessionPlayerService.joinSession. Session does
    // not import Invite (the player-joined bridge is event-based), so this is a
    // one-way dependency — no cycle, no forwardRef.
    SessionModule,
  ],
  controllers: [InviteController],
  providers: [InviteService],
  exports: [InviteService],
})
export class InviteModule {}
