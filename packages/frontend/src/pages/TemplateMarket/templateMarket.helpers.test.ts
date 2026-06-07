import { describe, expect, it } from 'vitest';
import { buildSaveMyVideoPayload, countTemplateFactors, getCategoryLabel } from './templateMarket.helpers';
import type { TemplateGenerateResult, TemplateGenerateRequest } from '@aigc/shared-types';

describe('template market helpers', () => {
  it('counts template factors from object fields', () => {
    expect(countTemplateFactors({ hook: 'pain', cta: 'buy' })).toBe(2);
  });

  it('falls back to raw category codes when labels are unknown', () => {
    expect(getCategoryLabel('beauty')).toBe('美妆');
    expect(getCategoryLabel('pets')).toBe('pets');
  });

  it('builds save payload from template, product info and generation result', () => {
    const productInfo: TemplateGenerateRequest = {
      productName: '草莓夹心饼干',
      category: 'food',
      sellingPoints: '酥脆',
      price: '19.9元',
      targetUser: '学生',
      promotion: '第二件半价',
      duration: '30秒',
      style: '开箱种草',
    };
    const result: TemplateGenerateResult = {
      title: '标题',
      script: '脚本',
      storyboard: [],
      publishCopy: '文案',
      tags: ['#零食'],
    };

    expect(buildSaveMyVideoPayload('template-1', '开箱种草型', productInfo, result)).toMatchObject({
      template_id: 'template-1',
      template_name: '开箱种草型',
      product_info: { productName: '草莓夹心饼干' },
      result: { title: '标题' },
    });
  });
});
