import { DeepPartial } from 'typeorm';
import { Player } from '../player.entity';

export type CreatePlayerRelations = DeepPartial<Pick<Player, 'session'>>;

export interface CreatePlayerInput {
  name: string;
  session: CreatePlayerRelations['session'];
}
