import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { getErrorMessage } from '../common/utils/error.util';

@ApiTags('Health')
@SkipThrottle() // platform health/readiness probes must never be rate-limited
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Liveness check — is the process up' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check — can the service serve traffic' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Database is not reachable' })
  async ready() {
    // Actually probe the DB: a liveness-only readiness check would report ready
    // while every real request 500s (DB unreachable / a boot migration failed),
    // so the platform would route traffic to a broken instance.
    try {
      await this.dataSource.query('SELECT 1');
    } catch (error) {
      this.logger.error(`Readiness check failed: ${getErrorMessage(error)}`);
      throw new ServiceUnavailableException('Database is not reachable');
    }
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  }
}
