import { EntityRepository, Repository } from 'typeorm';
import { Session } from './session.entity';
import { NotFoundException } from '@nestjs/common';

@EntityRepository(Session)
export class SessionRepository extends Repository<Session> {
  async findSessionWithFullDetails(id: string): Promise<Session> {
    const session = await this.createQueryBuilder('session')
      .leftJoinAndSelect('session.host', 'host')
      .leftJoinAndSelect('session.players', 'players')
      .leftJoinAndSelect('session.games', 'games')
      .leftJoinAndSelect('games.teams', 'teams')
      .where('session.id = :id', { id })
      .getOne();

    if (!session) {
      throw new NotFoundException(
        `Session with ID ${id} not found or failed to load relations`,
      );
    }

    return session;
  }

  async findAllWithDetails(): Promise<Session[]> {
    return this.createQueryBuilder('session')
      .leftJoinAndSelect('session.host', 'host')
      .leftJoinAndSelect('session.players', 'players')
      .leftJoinAndSelect('session.games', 'games')
      .orderBy('session.date', 'DESC')
      .getMany();
  }
}
