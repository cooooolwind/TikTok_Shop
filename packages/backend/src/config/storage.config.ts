import { registerAs } from '@nestjs/config';
import { isAbsolute, join } from 'path';

const backendRoot = join(__dirname, '..', '..');

function resolveUploadDir(value?: string) {
  if (!value) return join(backendRoot, 'uploads');
  return isAbsolute(value) ? value : join(backendRoot, value);
}

export default registerAs('storage', () => ({
  type: process.env.STORAGE_TYPE || 'local',
  localPath: resolveUploadDir(process.env.UPLOAD_DIR),
  maxImageSize: parseInt(process.env.MAX_FILE_SIZE_IMAGE || '20971520', 10),
  maxVideoSize: parseInt(process.env.MAX_FILE_SIZE_VIDEO || '524288000', 10),
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedVideoTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
}));
