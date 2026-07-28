import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { ClerkAuthGuard, OptionalClerkAuthGuard } from './clerk-auth.guard';
import { ClerkService } from '../clerk.service';
import { GamesMasterService } from '../../games-master/games-master.service';
import { GamesMaster } from '../../games-master/games-master.entity';
import { ErrorCode } from '../../common/errors/error-code.enum';

const expectTokenInvalid = async (promise: Promise<unknown>): Promise<void> => {
  await expect(promise).rejects.toBeInstanceOf(BadRequestException);
  await promise.catch((err: BadRequestException) => {
    expect((err.getResponse() as { code: string }).code).toBe(
      ErrorCode.TOKEN_INVALID,
    );
  });
};

type MutableRequest = {
  headers: { authorization?: string };
  gamesMaster?: GamesMaster;
};

const contextFor = (req: MutableRequest): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
  }) as unknown as ExecutionContext;

describe('ClerkAuthGuard', () => {
  const gm = { id: 'gm-1', name: 'Alice' } as GamesMaster;
  let clerk: jest.Mocked<Pick<ClerkService, 'verify' | 'getDisplayName'>>;
  let gamesMasterService: jest.Mocked<
    Pick<GamesMasterService, 'findOrCreateByClerkUserId'>
  >;

  beforeEach(() => {
    clerk = {
      verify: jest.fn(),
      getDisplayName: jest.fn().mockResolvedValue('Alice'),
    };
    gamesMasterService = {
      findOrCreateByClerkUserId: jest.fn().mockResolvedValue(gm),
    };
  });

  const makeGuard = () =>
    new ClerkAuthGuard(
      clerk as unknown as ClerkService,
      gamesMasterService as unknown as GamesMasterService,
    );
  const makeOptionalGuard = () =>
    new OptionalClerkAuthGuard(
      clerk as unknown as ClerkService,
      gamesMasterService as unknown as GamesMasterService,
    );

  it('attaches the GamesMaster for a valid Clerk token', async () => {
    clerk.verify.mockResolvedValue('user_123');
    const req: MutableRequest = {
      headers: { authorization: 'Bearer clerk.jwt' },
    };

    await expect(makeGuard().canActivate(contextFor(req))).resolves.toBe(true);
    expect(clerk.verify).toHaveBeenCalledWith('clerk.jwt');
    expect(gamesMasterService.findOrCreateByClerkUserId).toHaveBeenCalledWith(
      'user_123',
      'Alice',
    );
    expect(req.gamesMaster).toBe(gm);
  });

  it('rejects with TOKEN_INVALID when no token is present (required)', async () => {
    const req: MutableRequest = { headers: {} };
    await expectTokenInvalid(makeGuard().canActivate(contextFor(req)));
    expect(gamesMasterService.findOrCreateByClerkUserId).not.toHaveBeenCalled();
  });

  it('rejects when the token is not a valid Clerk token (required)', async () => {
    clerk.verify.mockResolvedValue(null);
    const req: MutableRequest = {
      headers: { authorization: 'Bearer not-clerk' },
    };
    await expectTokenInvalid(makeGuard().canActivate(contextFor(req)));
  });

  it('optional guard passes through without a token, attaching no GM', async () => {
    const req: MutableRequest = { headers: {} };
    await expect(
      makeOptionalGuard().canActivate(contextFor(req)),
    ).resolves.toBe(true);
    expect(req.gamesMaster).toBeUndefined();
    expect(clerk.verify).not.toHaveBeenCalled();
  });

  it('optional guard still attaches the GM when a valid token is present', async () => {
    clerk.verify.mockResolvedValue('user_123');
    const req: MutableRequest = {
      headers: { authorization: 'Bearer clerk.jwt' },
    };
    await expect(
      makeOptionalGuard().canActivate(contextFor(req)),
    ).resolves.toBe(true);
    expect(req.gamesMaster).toBe(gm);
  });
});
