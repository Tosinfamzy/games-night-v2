import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

/**
 * Base Gateway class that provides common WebSocket functionality
 * All gateways should extend this class
 */
export abstract class BaseGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  protected server: Server;
  protected abstract logger: Logger;

  /**
   * Called after the gateway is initialized
   */
  afterInit(server: Server): void {
    this.server = server;
    this.logger.log('WebSocket Gateway initialized');
  }

  /**
   * Called when a client connects
   */
  async handleConnection(client: Socket): Promise<void> {
    const clientId = client.id;
    const namespace = client.nsp.name;

    this.logger.log(
      `Client connected: ${clientId} to namespace: ${namespace}`,
    );

    // You can implement authentication here
    // const user = await this.authenticateClient(client);
    // if (!user) {
    //   client.disconnect();
    //   return;
    // }
  }

  /**
   * Called when a client disconnects
   */
  handleDisconnect(client: Socket): void {
    const clientId = client.id;
    const namespace = client.nsp.name;

    this.logger.log(
      `Client disconnected: ${clientId} from namespace: ${namespace}`,
    );
  }

  /**
   * Helper method to emit to a specific room
   */
  protected emitToRoom(room: string, event: string, data: any): void {
    this.server.to(room).emit(event, data);
  }

  /**
   * Helper method to emit to all clients
   */
  protected emitToAll(event: string, data: any): void {
    this.server.emit(event, data);
  }

  /**
   * Helper method to make client join a room
   */
  protected joinRoom(client: Socket, room: string): void {
    client.join(room);
    this.logger.debug(`Client ${client.id} joined room: ${room}`);
  }

  /**
   * Helper method to make client leave a room
   */
  protected leaveRoom(client: Socket, room: string): void {
    client.leave(room);
    this.logger.debug(`Client ${client.id} left room: ${room}`);
  }
}
