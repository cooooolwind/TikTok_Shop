import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MaterialCard from './index';
import { Material } from '@aigc/shared-types';

// Mock matchMedia for Ant Design components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const mockMaterial: Material = {
  id: '1',
  name: 'Test Image',
  filename: 'test-image.jpg',
  type: 'image',
  url: 'https://example.com/image.jpg',
  thumbnail_url: 'https://example.com/thumb.jpg',
  size: 1024,
  status: 'ready',
  category: 'product',
  tags: ['test'],
  source_declaration: 'owned',
  ai_tags: [],
  ai_description: '',
  created_at: '2024-05-30T00:00:00Z',
  updated_at: '2024-05-30T00:00:00Z',
};

describe('MaterialCard Hover Effect', () => {
  it('should change button opacity and background on hover', () => {
    render(<MaterialCard material={mockMaterial} />);
    
    const previewButton = screen.getByLabelText('预览图片');
    
    // Initial state: opacity 0
    expect(previewButton.style.opacity).toBe('0');
    expect(previewButton.style.background).toBe('rgba(0, 0, 0, 0)');

    // Find the cover container (the div with mouse events)
    // It's the parent of the image and the button
    const coverContainer = previewButton.parentElement!;

    // Hover
    fireEvent.mouseEnter(coverContainer);
    
    // Hovered state: opacity 1, background dark mask
    expect(previewButton.style.opacity).toBe('1');
    expect(previewButton.style.background).toBe('rgba(0, 0, 0, 0.45)');

    // Leave
    fireEvent.mouseLeave(coverContainer);
    
    // Back to initial state
    expect(previewButton.style.opacity).toBe('0');
    expect(previewButton.style.background).toBe('rgba(0, 0, 0, 0)');
  });
});
