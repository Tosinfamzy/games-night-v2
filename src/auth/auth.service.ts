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

    const expiresIn = this.configService.get<string>('JWT_EXPIRATION') || '15m';
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';

    const accessToken = this.jwtService.sign(payload, { expiresIn: expiresIn as any });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: refreshExpiresIn as any,
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
