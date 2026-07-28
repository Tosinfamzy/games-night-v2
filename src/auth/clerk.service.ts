import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  verifyToken,
  createClerkClient,
  type ClerkClient,
} from '@clerk/backend';
import { getErrorMessage } from '../common/utils/error.util';

/**
 * Thin wrapper around Clerk's backend SDK: verifies Clerk session JWTs and
 * resolves a display name for a Clerk user. When `CLERK_SECRET_KEY` is unset
 * (e.g. local test runs without Clerk configured) the service is inert —
 * `enabled` is false and `verify` returns null — so nothing 500s.
 */
@Injectable()
export class ClerkService {
  private readonly logger = new Logger(ClerkService.name);
  private readonly secretKey?: string;
  private readonly client: ClerkClient | null;

  constructor(private readonly config: ConfigService) {
    this.secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    this.client = this.secretKey
      ? createClerkClient({ secretKey: this.secretKey })
      : null;
    if (!this.secretKey) {
      this.logger.warn(
        'CLERK_SECRET_KEY is not set — games-master (Clerk) auth is disabled',
      );
    }
  }

  get enabled(): boolean {
    return Boolean(this.secretKey);
  }

  /**
   * Verify a Clerk session JWT. Returns the Clerk user id (`sub`) on success,
   * or null for any invalid/expired/foreign token. Never throws.
   */
  async verify(token: string): Promise<string | null> {
    if (!this.secretKey) {
      return null;
    }
    try {
      const payload = (await verifyToken(token, {
        secretKey: this.secretKey,
      })) as unknown as { sub?: unknown };
      const sub = payload.sub;
      return typeof sub === 'string' ? sub : null;
    } catch {
      // Malformed / expired / not a Clerk token — treat as unauthenticated.
      return null;
    }
  }

  /**
   * Best-effort human-friendly name for a Clerk user, used when we first
   * create the linked GamesMaster. Falls back to 'Games Master' on any error.
   */
  async getDisplayName(clerkUserId: string): Promise<string> {
    if (!this.client) {
      return 'Games Master';
    }
    try {
      const user = await this.client.users.getUser(clerkUserId);
      const fullName = [user.firstName, user.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (fullName) {
        return fullName;
      }
      const email = user.emailAddresses?.[0]?.emailAddress;
      if (email) {
        return email.split('@')[0];
      }
      return user.username ?? 'Games Master';
    } catch (error) {
      this.logger.warn(
        `Could not fetch Clerk user ${clerkUserId}: ${getErrorMessage(error)}`,
      );
      return 'Games Master';
    }
  }
}
