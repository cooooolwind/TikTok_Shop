import { registerAs } from '@nestjs/config';
import { join } from 'path';

export default registerAs('storage', () => ({
  type: process.env.STORAGE_TYPE || 'local',
  localPath: process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'),
  maxImageSize: parseInt(process.env.MAX_FILE_SIZE_IMAGE || '20971520', 10),
  maxVideoSize: parseInt(process.env.MAX_FILE_SIZE_VIDEO || '524288000', 10),
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedVideoTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
}));
