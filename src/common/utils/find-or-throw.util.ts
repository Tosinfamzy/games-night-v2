import { NotFoundException } from '@nestjs/common';
import { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';

/**
 * Load a single entity or throw NotFoundException. Centralises the
 * "findOne -> if (!x) throw NotFound" pattern so every lookup returns a
 * consistent 404 with a meaningful message.
 *
 * Takes the repository as an argument (rather than living on a base service) so
 * it adds no coupling to the existing service/gateway dependency graph.
 */
export async function findOneOrThrow<T extends ObjectLiteral>(
  repo: Repository<T>,
  where: FindOptionsWhere<T>,
  notFoundMessage: string,
  relations: string[] = [],
): Promise<T> {
  const entity = await repo.findOne({ where, relations });
  if (!entity) {
    throw new NotFoundException(notFoundMessage);
  }
  return entity;
}
