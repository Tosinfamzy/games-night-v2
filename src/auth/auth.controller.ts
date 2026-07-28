import { Controller, Post, Body, UseGuards, Get, Patch } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { CurrentGm } from './decorators/current-gm.decorator';
import { User } from '../user/user.entity';
import { GamesMaster } from '../games-master/games-master.entity';
import { GamesMasterResponseDto } from '../common/dto/games-master.response';
import { GamesMasterService } from '../games-master/games-master.service';
import { SessionResponseDto } from '../common/dto/session.response';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly gamesMasterService: GamesMasterService,
  ) {}

  // The legacy email/password endpoints are brute-forceable, so throttle them
  // tightly (host auth is Clerk now; these are candidates for removal).
  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user info' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  getCurrentUser(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isEmailVerified: user.isEmailVerified,
      gamesMasterId: user.gamesMasterProfile?.id,
      playerId: user.playerProfile?.id,
    };
  }

  @Get('games-master')
  @UseGuards(ClerkAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get the games master linked to the authenticated Clerk user',
  })
  @ApiResponse({ status: 200, description: 'Current games master' })
  @ApiResponse({
    status: 400,
    description: 'Not authenticated as a games master',
  })
  getCurrentGamesMaster(@CurrentGm() gm: GamesMaster): GamesMasterResponseDto {
    // ClerkAuthGuard guarantees gm is set (lazily created on first sign-in).
    return GamesMasterResponseDto.fromEntity(gm);
  }

  @Get('games-master/sessions')
  @UseGuards(ClerkAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List the sessions hosted by the authenticated games master',
  })
  @ApiResponse({ status: 200, description: "The games master's own sessions" })
  async getCurrentGamesMasterSessions(
    @CurrentGm() gm: GamesMaster,
  ): Promise<SessionResponseDto[]> {
    const sessions = await this.gamesMasterService.findSessions(gm.id);
    return sessions.map((session) => SessionResponseDto.fromEntity(session));
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  async changePassword(
    @CurrentUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
  }
}
