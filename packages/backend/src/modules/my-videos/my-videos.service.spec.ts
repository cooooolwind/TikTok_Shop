import { MyVideosService } from './my-videos.service';

describe('MyVideosService', () => {
  it('saves generated plans and returns latest items first', async () => {
    const repository = {
      create: jest.fn((data) => ({
        id: 'video-1',
        createdAt: new Date('2026-06-06T00:00:00.000Z'),
        ...data,
      })),
      save: jest.fn(async (data) => data),
      find: jest.fn(async () => [
        {
          id: 'video-1',
          merchantId: 'default',
          productName: 'Strawberry Cookies',
          templateId: 'builtin-unboxing',
          templateName: 'Unboxing',
          status: 'saved',
          productInfo: { productName: 'Strawberry Cookies' },
          result: { title: 'Plan', script: 'Script', storyboard: [], publishCopy: 'Copy', tags: [] },
          createdAt: new Date('2026-06-06T00:00:00.000Z'),
        },
      ]),
    };
    const service = new MyVideosService(repository as never);

    const saved = await service.create({
      template_id: 'builtin-unboxing',
      template_name: 'Unboxing',
      product_info: {
        productName: 'Strawberry Cookies',
        category: 'food',
        sellingPoints: 'crispy',
        price: '19.9',
        targetUser: 'students',
        promotion: '',
        duration: '30 seconds',
        style: 'unboxing',
      },
      result: { title: 'Plan', script: 'Script', storyboard: [], publishCopy: 'Copy', tags: [] },
    });
    const items = await service.findAll();

    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ productName: 'Strawberry Cookies' }));
    expect(saved.product_name).toBe('Strawberry Cookies');
    expect(items[0].template_name).toBe('Unboxing');
  });
});
