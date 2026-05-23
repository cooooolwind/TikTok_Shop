import type { ConfigModuleOptions } from '@nestjs/config';
import { join } from 'path';
import bullConfig from './bull.config';
import databaseConfig from './database.config';
import redisConfig from './redis.config';
import storageConfig from './storage.config';
import volcanoConfig from './volcano.config';

const cwd = process.cwd();

export const configModuleOptions: ConfigModuleOptions = {
  isGlobal: true,
  envFilePath: [
    join(cwd, '.env.local'),
    join(cwd, '.env'),
    join(cwd, '../../.env.local'),
    join(cwd, '../../.env'),
  ],
  load: [databaseConfig, redisConfig, bullConfig, storageConfig, volcanoConfig],
};
