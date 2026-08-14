import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateSetsDto } from './dto/create-sets.dto';
import { ListSetsQueryDto } from './dto/list-sets-query.dto';
import { SetsService } from './sets.service';

@Controller('sets')
@UseGuards(JwtAuthGuard)
export class SetsController {
  constructor(private readonly setsService: SetsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateSetsDto) {
    const sets = await this.setsService.create(user.id, dto);
    return { sets };
  }

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() query: ListSetsQueryDto) {
    return this.setsService.list(user.id, query);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.setsService.remove(user.id, id);
    return { success: true };
  }
}
