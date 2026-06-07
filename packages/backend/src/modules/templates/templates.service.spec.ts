import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { Template } from './entities/template.entity';

const now = new Date('2026-05-23T00:00:00.000Z');

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: 'template-1',
    merchantId: 'default',
    name: 'Problem Solution',
    strategy: 'Hook, problem, solution, CTA',
    factors: { hook: 'pain point' },
    constraints: ['short scenes'],
    applicableCategories: ['fashion'],
    derivedFrom: [],
    prompt: null,
    status: 'enabled',
    isBuiltin: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeService(options?: { template?: Template | null; templates?: Template[] }) {
  const template = options && 'template' in options ? options.template : makeTemplate();
  const templates = options?.templates ?? ([template].filter(Boolean) as Template[]);
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([templates, templates.length]),
  };
  const repository = {
    create: jest.fn((data) => makeTemplate(data)),
    save: jest.fn(async (data) => ({ ...makeTemplate(), ...data })),
    findOne: jest.fn(async () => template),
    remove: jest.fn(async (data) => data),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
  return { service: new TemplatesService(repository as never), repository, queryBuilder };
}

describe('TemplatesService', () => {
  it('returns builtin and user templates in a paginated list', async () => {
    const { service } = makeService({ templates: [makeTemplate()] });

    const result = await service.findAll({ page: 1, pageSize: 20 });

    expect(result.items.length).toBeGreaterThanOrEqual(6);
    expect(result.items.some((item) => item.is_builtin)).toBe(true);
  });

  it('creates user templates', async () => {
    const { service, repository } = makeService();

    const result = await service.create({
      name: 'Fast CTA',
      strategy: 'Show product and CTA',
      factors: { cta: 'buy now' },
      constraints: ['15s'],
      applicable_categories: ['fashion'],
      derived_from: [],
    });

    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ merchantId: 'default', isBuiltin: false }));
    expect(result.name).toBe('Fast CTA');
  });

  it('prevents updating builtin templates', async () => {
    const { service } = makeService({ template: makeTemplate({ isBuiltin: true }) });

    await expect(service.update('template-1', { name: 'New name' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents deleting builtin templates', async () => {
    const { service } = makeService({ template: makeTemplate({ isBuiltin: true }) });

    await expect(service.remove('template-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFoundException when user template is missing', async () => {
    const { service } = makeService({ template: null });

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('generates a shoppable video plan from a template and product info', async () => {
    const { service } = makeService();

    const result = await service.generate('builtin-problem-solution', {
      productName: 'Strawberry Cookies',
      category: 'food',
      sellingPoints: 'crispy, strawberry flavor',
      price: '19.9',
      targetUser: 'students',
      promotion: 'second half price',
      duration: '30 seconds',
      style: 'unboxing',
    });

    expect(result.title).toContain('Strawberry Cookies');
    expect(result.storyboard).toHaveLength(5);
    expect(result.storyboard[0]).toHaveProperty('videoPrompt');
    expect(result.tags.length).toBeGreaterThanOrEqual(3);
  });
});
