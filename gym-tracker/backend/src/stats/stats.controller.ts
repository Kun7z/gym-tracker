import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../shared/decorators/current-user.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { HistoryQueryDto } from './dto/history-query.dto';
import { StatsService } from './stats.service';

@Controller('exercises')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get(':id/history')
  async history(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: HistoryQueryDto,
  ) {
    return this.statsService.history(user.id, id, query);
  }

  @Get(':id/summary')
  async summary(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.statsService.summary(user.id, id);
  }
}
