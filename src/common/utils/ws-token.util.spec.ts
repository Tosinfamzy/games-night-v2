import { extractPlayerToken } from './ws-token.util';

describe('extractPlayerToken', () => {
  it('prefers auth.playerToken', () => {
    expect(
      extractPlayerToken({
        auth: { playerToken: 'p', token: 't' },
        query: { playerToken: 'q' },
      }),
    ).toBe('p');
  });

  it('falls back to auth.token when playerToken is absent', () => {
    expect(extractPlayerToken({ auth: { token: 't' } })).toBe('t');
  });

  it('falls back to query.playerToken when auth has no token', () => {
    expect(extractPlayerToken({ auth: {}, query: { playerToken: 'q' } })).toBe(
      'q',
    );
  });

  it('returns null when nothing is present', () => {
    expect(extractPlayerToken({})).toBeNull();
    expect(extractPlayerToken({ auth: {}, query: {} })).toBeNull();
  });

  it('ignores non-string values', () => {
    expect(
      extractPlayerToken({
        auth: { playerToken: 123 as unknown as string },
        query: { playerToken: ['q'] as unknown as string },
      }),
    ).toBeNull();
  });
});
