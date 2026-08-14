import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CatalogService } from './catalog.service';
import { CatalogSyncService } from './catalog-sync.service';
import { CatalogListQueryDto } from './dto/catalog-list-query.dto';

@Controller('catalog')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly syncService: CatalogSyncService,
  ) {}

  @Get('exercises')
  async list(@Query() query: CatalogListQueryDto) {
    return this.catalogService.listExercises(query);
  }

  @Get('exercises/:id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.getExercise(id);
  }

  @Get('equipment')
  async listEquipment() {
    return this.catalogService.listEquipment();
  }

  @Get('muscles')
  async listMuscles() {
    return this.catalogService.listMuscles();
  }

  @Get('categories')
  async listCategories() {
    return this.catalogService.listCategories();
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async sync() {
    return this.syncService.runSync();
  }

  @Get('sync/status')
  async status() {
    return this.syncService.status();
  }
}
