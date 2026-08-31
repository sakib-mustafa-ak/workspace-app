import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

import { PRICED_PLANS, type PricedPlan } from '../billing.constants';

export class CheckoutDto {
  @ApiProperty({ example: '1a2b3c4d-5e6f-4a5b-6c7d-8e9f0a1b2c3d' })
  @IsUUID()
  workspaceId!: string;

  @ApiProperty({ enum: PRICED_PLANS })
  @IsIn(['PRO', 'TEAM'])
  plan!: PricedPlan;
}
