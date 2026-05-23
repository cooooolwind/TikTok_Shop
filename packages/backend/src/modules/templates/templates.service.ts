import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CreateTemplateRequest, Template as TemplateResponse, TemplateListQuery } from '@aigc/shared-types';
import { Template } from './entities/template.entity';

const DEFAULT_MERCHANT_ID = 'default';

const BUILTIN_TEMPLATES: TemplateResponse[] = [
  {
    id: 'builtin-problem-solution',
    name: '痛点解决型',
    strategy: '3 秒痛点钩子，展示商品解决方案，强化利益点，结尾行动号召。',
    factors: { hook: '痛点提问', proof: '商品演示', cta: '立即下单' },
    constraints: ['总时长控制在 15-25 秒', '每个分镜只表达一个核心信息'],
    applicable_categories: ['fashion', 'beauty', 'home', 'electronics'],
    derived_from: [],
    is_builtin: true,
    created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
  {
    id: 'builtin-before-after',
    name: '前后对比型',
    strategy: '先展示使用前状态，再展示使用后效果，通过对比建立购买理由。',
    factors: { contrast: '前后变化', scene: '真实使用场景', trust: '细节证明' },
    constraints: ['必须包含对比画面', '避免夸大无法证明的效果'],
    applicable_categories: ['beauty', 'home', 'fashion'],
    derived_from: [],
    is_builtin: true,
    created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
];

@Injectable()
export class TemplatesService {
  constructor(@InjectRepository(Template) private readonly templatesRepository: Repository<Template>) {}

  async create(data: CreateTemplateRequest) {
    const template = this.templatesRepository.create({
      merchantId: DEFAULT_MERCHANT_ID,
      name: data.name,
      strategy: data.strategy,
      factors: data.factors,
      constraints: data.constraints,
      applicableCategories: data.applicable_categories,
      derivedFrom: data.derived_from ?? [],
      isBuiltin: false,
    });
    return this.toResponse(await this.templatesRepository.save(template));
  }

  async findAll(query: TemplateListQuery = {}) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.max(Number(query.pageSize ?? 20), 1);
    const qb = this.templatesRepository
      .createQueryBuilder('template')
      .where('template.merchant_id = :merchantId', { merchantId: DEFAULT_MERCHANT_ID })
      .orderBy('template.created_at', 'DESC');

    if (query.keyword) {
      qb.andWhere('(template.name ILIKE :keyword OR template.strategy ILIKE :keyword)', { keyword: `%${query.keyword}%` });
    }

    if (query.category) {
      qb.andWhere('template.applicable_categories::text ILIKE :category', { category: `%${query.category}%` });
    }

    const [userTemplates, userTotal] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const builtins = this.filterBuiltins(query);
    const items = [...builtins, ...userTemplates.map((template) => this.toResponse(template))];
    const total = builtins.length + userTotal;

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const builtin = this.findBuiltin(id);
    if (builtin) return builtin;

    const template = await this.templatesRepository.findOne({ where: { id, merchantId: DEFAULT_MERCHANT_ID } });
    if (!template) throw new NotFoundException('Template not found');
    return this.toResponse(template);
  }

  async findRawById(id: string) {
    const builtin = this.findBuiltin(id);
    if (builtin) return builtin;

    const template = await this.templatesRepository.findOne({ where: { id, merchantId: DEFAULT_MERCHANT_ID } });
    if (!template) return null;
    return this.toResponse(template);
  }

  async update(id: string, data: Partial<CreateTemplateRequest>) {
    if (this.findBuiltin(id)) throw new BadRequestException('Builtin templates are read-only');
    const template = await this.templatesRepository.findOne({ where: { id, merchantId: DEFAULT_MERCHANT_ID } });
    if (!template) throw new NotFoundException('Template not found');
    if (template.isBuiltin) throw new BadRequestException('Builtin templates are read-only');

    if (data.name !== undefined) template.name = data.name;
    if (data.strategy !== undefined) template.strategy = data.strategy;
    if (data.factors !== undefined) template.factors = data.factors;
    if (data.constraints !== undefined) template.constraints = data.constraints;
    if (data.applicable_categories !== undefined) template.applicableCategories = data.applicable_categories;
    if (data.derived_from !== undefined) template.derivedFrom = data.derived_from;

    return this.toResponse(await this.templatesRepository.save(template));
  }

  async remove(id: string) {
    if (this.findBuiltin(id)) throw new BadRequestException('Builtin templates are read-only');
    const template = await this.templatesRepository.findOne({ where: { id, merchantId: DEFAULT_MERCHANT_ID } });
    if (!template) throw new NotFoundException('Template not found');
    if (template.isBuiltin) throw new BadRequestException('Builtin templates are read-only');
    await this.templatesRepository.remove(template);
    return { message: 'deleted' };
  }

  private filterBuiltins(query: TemplateListQuery) {
    return BUILTIN_TEMPLATES.filter((template) => {
      const keywordOk =
        !query.keyword ||
        template.name.toLowerCase().includes(query.keyword.toLowerCase()) ||
        template.strategy.toLowerCase().includes(query.keyword.toLowerCase());
      const categoryOk = !query.category || template.applicable_categories.includes(query.category);
      return keywordOk && categoryOk;
    });
  }

  private findBuiltin(id: string) {
    return BUILTIN_TEMPLATES.find((template) => template.id === id) ?? null;
  }

  private toResponse(template: Template): TemplateResponse {
    return {
      id: template.id,
      name: template.name,
      strategy: template.strategy,
      factors: template.factors ?? {},
      constraints: template.constraints ?? [],
      applicable_categories: template.applicableCategories ?? [],
      derived_from: template.derivedFrom ?? [],
      is_builtin: template.isBuiltin,
      created_at: template.createdAt.toISOString(),
      updated_at: template.updatedAt.toISOString(),
    };
  }
}
