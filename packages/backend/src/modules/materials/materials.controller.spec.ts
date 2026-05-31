import { Test, TestingModule } from '@nestjs/testing';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';

describe('MaterialsController', () => {
  let controller: MaterialsController;
  let service: MaterialsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaterialsController],
      providers: [
        {
          provide: MaterialsService,
          useValue: {
            analyze: jest.fn().mockResolvedValue({ task_id: 'job-1', status: 'queued' }),
          },
        },
      ],
    }).compile();

    controller = module.get<MaterialsController>(MaterialsController);
    service = module.get<MaterialsService>(MaterialsService);
  });

  it('should call service.analyze when POST /materials/:id/analyze is called', async () => {
    const id = 'test-uuid';
    const result = await controller.analyze(id);
    expect(service.analyze).toHaveBeenCalledWith(id);
    expect(result).toEqual({ task_id: 'job-1', status: 'queued' });
  });
});
