import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusTag from './';

describe('StatusTag', () => {
  it('should render status text', () => {
    render(<StatusTag status="done" />);
    expect(screen.getByText('done')).toBeDefined();
  });

  it('should use custom labels when provided', () => {
    render(<StatusTag status="done" labels={{ done: '已完成' }} />);
    expect(screen.getByText('已完成')).toBeDefined();
  });

  it('should fall back to raw status when no label', () => {
    render(<StatusTag status="unknown" />);
    expect(screen.getByText('unknown')).toBeDefined();
  });

  it('should render an Ant Design Tag', () => {
    const { container } = render(<StatusTag status="processing" />);
    expect(container.querySelector('.ant-tag')).not.toBeNull();
  });
});
