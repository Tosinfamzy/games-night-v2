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

  it('ignores query.playerToken — the token is never read from the query string', () => {
    expect(
      extractPlayerToken({ auth: {}, query: { playerToken: 'q' } }),
    ).toBeNull();
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
