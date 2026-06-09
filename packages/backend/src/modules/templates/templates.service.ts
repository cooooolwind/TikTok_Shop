import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  CreateTemplateRequest,
  Template as TemplateResponse,
  TemplateGenerateRequest,
  TemplateGenerateResult,
  TemplateListQuery,
} from '@aigc/shared-types';
import { buildTemplatePrompt } from '../../ai/prompts';
import { Template } from './entities/template.entity';

const DEFAULT_MERCHANT_ID = 'default';
const BUILTIN_DATE = new Date('2026-01-01T00:00:00.000Z').toISOString();

function builtin(
  id: string,
  name: string,
  strategy: string,
  applicableCategories: string[],
  factors: Record<string, string>,
): TemplateResponse {
  return {
    id,
    name,
    strategy,
    factors,
    constraints: ['不要夸大商品功效', '不要虚假宣传', '避免使用绝对化表达'],
    applicable_categories: applicableCategories,
    derived_from: [],
    prompt: buildTemplatePrompt(name, strategy, factors),
    status: 'enabled',
    is_builtin: true,
    created_at: BUILTIN_DATE,
    updated_at: BUILTIN_DATE,
  };
}

const BUILTIN_TEMPLATES: TemplateResponse[] = [
  builtin(
    'builtin-problem-solution',
    '痛点解决型',
    '先提出用户痛点，再展示商品解决方案，最后强化购买理由。',
    ['beauty', 'home', 'electronics', 'fashion'],
    { pain: '痛点', solution: '解决方案', cta: '转化引导' },
  ),
  builtin(
    'builtin-before-after',
    '前后对比型',
    '先展示使用前状态，再展示使用后效果，通过对比突出商品价值。',
    ['beauty', 'home', 'fashion'],
    { before: '使用前', after: '使用后', contrast: '效果对比' },
  ),
  builtin(
    'builtin-unboxing',
    '开箱种草型',
    '通过开箱、细节展示和真实体验，营造种草氛围。',
    ['food', 'beauty', 'electronics', 'general'],
    { unboxing: '开箱', detail: '细节', experience: '体验' },
  ),
  builtin(
    'builtin-feature-demo',
    '功能展示型',
    '重点展示商品功能、参数和使用场景，适合偏理性消费商品。',
    ['electronics', 'home'],
    { feature: '功能', parameter: '参数', scene: '场景' },
  ),
  builtin(
    'builtin-scene-immersion',
    '场景代入型',
    '构造真实生活场景，让用户感受到商品在实际生活中的价值。',
    ['home', 'fashion', 'food', 'beauty'],
    { scene: '场景', need: '需求', experience: '使用体验' },
  ),
  builtin(
    'builtin-viral-general',
    '通用爆款型',
    '使用短视频常见爆款结构，先吸引注意，再讲卖点，最后引导下单。',
    ['general'],
    { hook: '钩子', sellingPoint: '卖点', cta: '行动引导' },
  ),
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
      prompt: data.prompt ?? buildTemplatePrompt(data.name, data.strategy, data.factors),
      status: data.status ?? 'enabled',
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

    if (query.status) {
      qb.andWhere('template.status = :status', { status: query.status });
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
    const builtinTemplate = this.findBuiltin(id);
    if (builtinTemplate) return builtinTemplate;

    const template = await this.templatesRepository.findOne({ where: { id, merchantId: DEFAULT_MERCHANT_ID } });
    if (!template) throw new NotFoundException('Template not found');
    return this.toResponse(template);
  }

  async findRawById(id: string) {
    const builtinTemplate = this.findBuiltin(id);
    if (builtinTemplate) return builtinTemplate;

    const template = await this.templatesRepository.findOne({ where: { id, merchantId: DEFAULT_MERCHANT_ID } });
    if (!template) return null;
    return this.toResponse(template);
  }

  async generate(id: string, data: TemplateGenerateRequest): Promise<TemplateGenerateResult> {
    const template = await this.findOne(id);
    if (template.status === 'disabled') throw new BadRequestException('Template is disabled');

    const sellingPoints = data.sellingPoints
      .split(/[,\n，、]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const mainSellingPoint = sellingPoints[0] ?? data.sellingPoints;
    const promotion = data.promotion?.trim() || '当前优惠活动';
    const factorText = Object.values(template.factors).join('、');

    return {
      title: `${data.productName}这样讲，${data.targetUser}更容易被打动`,
      script: [
        `你是不是也在找一款适合${data.targetUser}的${data.category}好物？`,
        `今天用「${template.name}」的方式讲${data.productName}，先抓住真实需求，再把${mainSellingPoint}这些卖点讲清楚。`,
        `${data.productName}的价格是${data.price}，现在还有${promotion}。`,
        `如果你想要${data.style}风格、${data.duration}左右的带货视频，这套方案可以直接进入拍摄和生成流程。`,
      ].join(''),
      storyboard: [
        {
          shot: 1,
          content: `开场用${template.name}钩子引出需求，点出${data.targetUser}的购买场景。`,
          videoPrompt: `Commercial short video opening shot for ${data.productName}, focused on target users, clean TikTok Shop style, vertical 9:16`,
        },
        {
          shot: 2,
          content: `展示商品包装和核心细节，突出${mainSellingPoint}。`,
          videoPrompt: `Close-up product showcase of ${data.productName}, highlight packaging and texture, bright soft lighting, ecommerce advertising`,
        },
        {
          shot: 3,
          content: `结合${data.category}使用场景，说明${data.sellingPoints}。`,
          videoPrompt: `Lifestyle usage scene for ${data.productName}, realistic daily environment, product benefits visible, natural handheld camera`,
        },
        {
          shot: 4,
          content: `按照模板因子「${factorText}」强化购买理由，避免夸大表达。`,
          videoPrompt: `Benefit demonstration shot for ${data.productName}, trustworthy product demo, clear composition, no exaggerated effects`,
        },
        {
          shot: 5,
          content: `收尾给出价格和${promotion}，引导用户点击下单或收藏。`,
          videoPrompt: `Final call-to-action product shot for ${data.productName}, price and promotion mood, clean commercial layout, vertical video`,
        },
      ],
      publishCopy: `${data.productName}带货视频方案来了！适合${data.targetUser}，主打${data.sellingPoints}，${promotion}，拍摄时按「${template.name}」结构推进更清楚。`,
      tags: [`#${data.category}推荐`, `#${data.productName}`, `#${template.name}`, '#带货短视频'],
    };
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
    if (data.prompt !== undefined) template.prompt = data.prompt;
    if (data.status !== undefined) template.status = data.status;

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
      const statusOk = !query.status || template.status === query.status;
      return keywordOk && categoryOk && statusOk;
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
      prompt: template.prompt ?? buildTemplatePrompt(template.name, template.strategy, template.factors ?? {}),
      status: template.status ?? 'enabled',
      is_builtin: template.isBuiltin,
      created_at: template.createdAt.toISOString(),
      updated_at: template.updatedAt.toISOString(),
    };
  }
}
