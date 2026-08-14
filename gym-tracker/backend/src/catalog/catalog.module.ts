import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogSyncService } from './catalog-sync.service';
import { WgerApiClient } from './wger-api.client';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, CatalogSyncService, WgerApiClient],
})
export class CatalogModule {}
