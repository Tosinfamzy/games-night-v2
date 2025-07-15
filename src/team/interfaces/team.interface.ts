import { DeepPartial } from 'typeorm';
import { Team } from '../team.entity';

export type CreateTeamRelations = DeepPartial<Pick<Team, 'game'>>;

export interface CreateTeamInput {
  name: string;
  game: CreateTeamRelations['game'];
}
