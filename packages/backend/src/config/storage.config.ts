import { registerAs } from '@nestjs/config';
import { isAbsolute, join } from 'path';
import { existsSync } from 'fs';

function resolveUploadDir(value?: string) {
  const cwd = process.cwd();
  const backendPath = existsSync(join(cwd, 'packages', 'backend')) 
    ? join(cwd, 'packages', 'backend') 
    : cwd;

  if (!value) return join(backendPath, 'uploads');
  return isAbsolute(value) ? value : join(backendPath, value);
}

export default registerAs('storage', () => ({
  type: process.env.STORAGE_TYPE || 'local',
  localPath: resolveUploadDir(process.env.UPLOAD_DIR),
  maxImageSize: parseInt(process.env.MAX_FILE_SIZE_IMAGE || '20971520', 10),
  maxVideoSize: parseInt(process.env.MAX_FILE_SIZE_VIDEO || '524288000', 10),
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedVideoTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
}));
