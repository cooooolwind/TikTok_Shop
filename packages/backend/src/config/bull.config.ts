import { registerAs } from '@nestjs/config';
import type { BullRootModuleOptions } from '@nestjs/bullmq';

export default registerAs('bull', (): BullRootModuleOptions => ({
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
}));
