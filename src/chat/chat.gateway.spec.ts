import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { PlayerService } from '../player/player.service';
import { AppSocket } from '../common/types/socket.types';

/**
 * The gateway must treat the socket's authenticated player as the source of
 * truth for identity — never the client-supplied payload — and must throttle
 * floods. These tests exercise that directly.
 */
describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatService: { saveMessage: jest.Mock; getMessageHistory: jest.Mock };
  let emitToRoom: jest.SpyInstance;

  const AUTH = {
    playerId: 'real-player',
    sessionId: 'real-session',
    playerName: 'Real Player',
  };

  const makeClient = (id = 'socket-1'): AppSocket =>
    ({
      id,
      data: { player: { ...AUTH } },
      emit: jest.fn(),
    }) as unknown as AppSocket;

  beforeEach(() => {
    chatService = {
      saveMessage: jest.fn().mockResolvedValue({ playerName: AUTH.playerName }),
      getMessageHistory: jest
        .fn()
        .mockResolvedValue({ messages: [], hasMore: false }),
    };
    gateway = new ChatGateway(
      chatService as unknown as ChatService,
      {} as unknown as PlayerService,
    );
    emitToRoom = jest
      .spyOn(gateway as unknown as { emitToRoom: () => void }, 'emitToRoom')
      .mockImplementation(() => undefined);
  });

  it('saves with the socket identity, ignoring spoofed payload ids', async () => {
    const client = makeClient();
    await gateway.handleSendMessage(
      {
        content: 'hi',
        // Attacker-supplied — must be ignored.
        playerId: 'victim-player',
        sessionId: 'other-session',
      },
      client,
    );

    expect(chatService.saveMessage).toHaveBeenCalledWith({
      content: 'hi',
      playerId: AUTH.playerId,
      sessionId: AUTH.sessionId,
    });
    // Broadcast to the caller's real session room only.
    expect(emitToRoom).toHaveBeenCalledWith(
      `chat:session:${AUTH.sessionId}`,
      'chat:message-sent',
      expect.anything(),
    );
  });

  it('loads history only for the caller’s own session', async () => {
    const client = makeClient();
    await gateway.handleLoadHistory(
      { sessionId: 'someone-elses-session', limit: 50 },
      client,
    );

    expect(chatService.getMessageHistory).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: AUTH.sessionId }),
    );
  });

  it('rejects an unauthenticated socket without saving', async () => {
    const client = {
      id: 's',
      data: {},
      emit: jest.fn(),
    } as unknown as AppSocket;
    await gateway.handleSendMessage({ content: 'x' } as never, client);

    expect(chatService.saveMessage).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(
      'chat:error',
      expect.objectContaining({ code: 'TOKEN_INVALID' }),
    );
  });

  it('rate-limits a flood of messages from one socket', async () => {
    const client = makeClient();
    // RATE_MAX is 10 — send 10, all pass.
    for (let i = 0; i < 10; i++) {
      await gateway.handleSendMessage({ content: `m${i}` } as never, client);
    }
    expect(chatService.saveMessage).toHaveBeenCalledTimes(10);

    // The 11th within the window is blocked.
    await gateway.handleSendMessage({ content: 'flood' } as never, client);
    expect(chatService.saveMessage).toHaveBeenCalledTimes(10);
    expect(client.emit).toHaveBeenCalledWith(
      'chat:error',
      expect.objectContaining({ code: 'RATE_LIMITED' }),
    );
  });
});
