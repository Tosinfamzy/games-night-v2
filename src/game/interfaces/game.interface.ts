import { DeepPartial } from 'typeorm';
import { Game } from '../game.entity';

export type CreateGameRelations = DeepPartial<Pick<Game, 'session'>>;

export interface CreateGameInput {
  name: string;
  session: CreateGameRelations['session'];
}
