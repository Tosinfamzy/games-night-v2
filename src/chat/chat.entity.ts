import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Session } from '../session/session.entity';
import { Player } from '../player/player.entity';
import { MessageType } from './enums/message-type.enum';

@Entity('messages')
export class Message {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unique identifier for the message',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'Hello everyone!',
    description: 'Message content',
  })
  @Column('text')
  content: string;

  @ApiProperty({ type: () => Session })
  @ManyToOne(() => Session, { eager: true })
  session: Session;

  @ApiProperty({ type: () => Player })
  @ManyToOne(() => Player, { eager: true })
  player: Player;

  @ApiProperty({
    example: MessageType.TEXT,
    enum: MessageType,
    description: 'Type of message',
  })
  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  @ApiProperty({
    example: false,
    description: 'Whether the message has been edited',
  })
  @Column({ default: false })
  isEdited: boolean;

  @ApiProperty({
    example: '2025-07-19T10:35:00Z',
    description: 'When the message was last edited',
    required: false,
  })
  @Column({ type: 'timestamp', nullable: true })
  editedAt?: Date;

  @ApiProperty({
    example: '2025-07-19T10:30:00Z',
    description: 'When the message was created',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    example: '2025-07-19T10:30:00Z',
    description: 'When the message was last updated',
  })
  @UpdateDateColumn()
  updatedAt: Date;
}
