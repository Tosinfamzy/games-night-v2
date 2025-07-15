import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  OneToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Session } from '../session/session.entity';
import { Team } from '../team/team.entity';
import { Score } from '../score/score.entity';

@Entity()
export class Player {
  @ApiProperty({ example: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Bob' })
  @Column()
  name: string;

  @ApiProperty({ type: () => Session })
  @ManyToOne(() => Session, (session) => session.players, { eager: true })
  session: Session;

  @ApiProperty({ type: () => [Team] })
  @ManyToMany(() => Team, (team) => team.players)
  @JoinTable()
  teams: Team[];

  @ApiProperty({ type: () => [Score] })
  @OneToMany(() => Score, (score) => score.player)
  scores: Score[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
