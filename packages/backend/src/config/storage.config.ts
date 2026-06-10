import { registerAs } from '@nestjs/config';
import { isAbsolute, join } from 'path';


function resolveUploadDir(value?: string) {
  if (value && isAbsolute(value)) {
    console.log(`[StorageConfig] Using absolute path: ${value}`);
    return value;
  }
  
  const backendPath = join(__dirname, '..', '..');
  const resolved = value ? join(backendPath, value) : join(backendPath, 'uploads');
  console.log(`[StorageConfig] Resolved upload dir:`);
  console.log(`  - __dirname: ${__dirname}`);
  console.log(`  - backendPath: ${backendPath}`);
  console.log(`  - value: ${value || 'undefined'}`);
  console.log(`  - final path: ${resolved}`);
  
  return resolved;
}

export default registerAs('storage', () => ({
  type: process.env.STORAGE_TYPE || 'local',
  localPath: resolveUploadDir(process.env.UPLOAD_DIR),
  maxImageSize: parseInt(process.env.MAX_FILE_SIZE_IMAGE || '20971520', 10),
  maxVideoSize: parseInt(process.env.MAX_FILE_SIZE_VIDEO || '524288000', 10),
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedVideoTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
}));
