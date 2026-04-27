import { Injectable } from '@nestjs/common';
import { AnalyticsStudioQueryService } from './analytics-studio-query.service';
import { AnalyticsStudioQueryDto } from './dto/analytics-studio-query.dto';
import type { AnalyticsStudioPayload } from './analytics-studio.types';

type UserLike = { role?: string; companyIds?: string[] };

@Injectable()
export class AnalyticsService {
  constructor(private readonly studioQuery: AnalyticsStudioQueryService) {}

  getStudio(user: UserLike, query: AnalyticsStudioQueryDto): Promise<AnalyticsStudioPayload> {
    return this.studioQuery.buildStudioPayload(user, query);
  }
}
