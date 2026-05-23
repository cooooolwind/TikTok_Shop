import { SystemService } from './system.service';

describe('SystemService', () => {
  let service: SystemService;

  beforeEach(() => {
    service = new SystemService();
  });

  describe('health', () => {
    it('should return status ok', () => {
      const result = service.health();
      expect(result.status).toBe('ok');
      expect(result.version).toBeDefined();
      expect(result.services.database).toBe('ok');
      expect(result.services.redis).toBe('ok');
      expect(result.services.volcano_api).toBe('ok');
    });
  });

  describe('upload', () => {
    it('should return a stub upload response', () => {
      const result = service.upload();
      expect(result.url).toBe('stub');
      expect(result.filename).toBe('stub');
      expect(result.size).toBe(0);
    });
  });
});
