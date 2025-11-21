import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { GamesMaster } from '../games-master/games-master.entity';
import { Player } from '../player/player.entity';
import { Exclude } from 'class-transformer';

export enum UserRole {
  GAMES_MASTER = 'games_master',
  PLAYER = 'player',
}

@Entity('users')
export class User {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Unique identifier',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'alice@example.com',
    description: 'User email address',
  })
  @Column({ unique: true })
  email: string;

  @Exclude()
  @Column()
  password: string;

  @ApiProperty({
    example: 'Alice',
    description: 'User display name',
  })
  @Column()
  name: string;

  @ApiProperty({
    example: 'games_master',
    enum: UserRole,
    description: 'User role - games master or player',
  })
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.PLAYER,
  })
  role: UserRole;

  @ApiProperty({
    example: 'https://example.com/avatar.jpg',
    description: 'User avatar URL',
    required: false,
  })
  @Column({ nullable: true })
  avatarUrl?: string;

  @ApiProperty({
    example: false,
    description: 'Whether the user has verified their email',
  })
  @Column({ default: false })
  isEmailVerified: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiProperty({
    type: () => GamesMaster,
    description: 'Linked games master profile (if role is games_master)',
    required: false,
  })
  @OneToOne(() => GamesMaster, { nullable: true, eager: true })
  @JoinColumn()
  gamesMasterProfile?: GamesMaster;

  @ApiProperty({
    type: () => Player,
    description: 'Linked player profile (if role is player)',
    required: false,
  })
  @OneToOne(() => Player, { nullable: true, eager: true })
  @JoinColumn()
  playerProfile?: Player;
}
