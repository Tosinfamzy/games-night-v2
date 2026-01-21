import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { User, UserRole } from '../user/user.entity';
import { GamesMasterService } from '../games-master/games-master.service';
import { TIME, TIME_MULTIPLIERS } from '../common/constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly gamesMasterService: GamesMasterService,
  ) {}

  async signup(signupDto: SignupDto) {
    const existingUser = await this.userService.findByEmail(signupDto.email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(signupDto.password, 10);

    // Create user
    const user = await this.userService.create({
      email: signupDto.email,
      name: signupDto.name,
      password: hashedPassword,
      role: signupDto.role || UserRole.PLAYER,
    });

    // Create linked profile if games master
    if (user.role === UserRole.GAMES_MASTER) {
      const gamesMaster = await this.gamesMasterService.create({
        name: user.name,
      });
      user.gamesMasterProfile = gamesMaster;
      await this.userService.update(user.id, {
        gamesMasterProfile: gamesMaster,
      });
    }

    return this.generateTokens(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.userService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<{ sub: string }>(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.userService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userService.update(userId, { password: hashedPassword });

    return { message: 'Password changed successfully' };
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.userService.findById(userId);
  }

  /**
   * Generate player-specific JWT token for session participation
   * Used for both guest and authenticated players
   * Token lasts 24 hours (duration of a typical game night)
   */
  generatePlayerToken(
    playerId: string,
    sessionId: string,
    playerName: string,
  ): string {
    const payload = {
      type: 'player',
      playerId,
      sessionId,
      playerName,
    };

    // 24 hours expiration for game night duration
    return this.jwtService.sign(payload, {
      expiresIn: TIME.PLAYER_TOKEN_EXPIRY_SECONDS,
    });
  }

  /**
   * Validate and decode a player token
   * Returns null if token is invalid or expired
   */
  validatePlayerToken(
    token: string,
  ): { playerId: string; sessionId: string; playerName: string } | null {
    try {
      const payload = this.jwtService.verify<{
        type: string;
        playerId: string;
        sessionId: string;
        playerName: string;
      }>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      if (payload.type !== 'player') {
        return null;
      }

      return {
        playerId: payload.playerId,
        sessionId: payload.sessionId,
        playerName: payload.playerName,
      };
    } catch {
      return null;
    }
  }

  private generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      profileId:
        user.role === UserRole.GAMES_MASTER
          ? user.gamesMasterProfile?.id
          : user.playerProfile?.id,
    };

    // Convert string duration to seconds for JWT library
    const parseExpiration = (exp: string): number => {
      const unit = exp.slice(-1);
      const value = parseInt(exp.slice(0, -1), 10);
      return value * (TIME_MULTIPLIERS[unit] || 1);
    };

    const accessExpiration =
      this.configService.get<string>('JWT_EXPIRATION') || '15m';
    const refreshExpiration =
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: parseExpiration(accessExpiration),
    });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: parseExpiration(refreshExpiration),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        gamesMasterId: user.gamesMasterProfile?.id,
        playerId: user.playerProfile?.id,
      },
    };
  }
}
