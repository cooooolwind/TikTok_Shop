import { Test } from '@nestjs/testing';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';

describe('SystemController', () => {
  let controller: SystemController;
  let service: SystemService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [SystemController],
      providers: [SystemService],
    }).compile();

    controller = module.get(SystemController);
    service = module.get(SystemService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /health', () => {
    it('should return health status from service', () => {
      const result = controller.health();
      expect(result).toEqual(service.health());
    });
  });

  describe('POST /upload', () => {
    it('should return upload stub from service', () => {
      const result = controller.upload();
      expect(result).toEqual(service.upload());
    });
  });
});
