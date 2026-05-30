import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MaterialCard from './index';

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

const mockMaterial = {
  id: '1',
  name: 'Test Image',
  type: 'image',
  url: 'https://example.com/image.jpg',
  thumbnail_url: 'https://example.com/thumb.jpg',
  size: 1024,
  status: 'ready',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('MaterialCard Hover Effect', () => {
  it('should change button opacity and background on hover', () => {
    render(<MaterialCard material={mockMaterial as any} />);
    
    const previewButton = screen.getByLabelText('预览图片');
    
    // Initial state: opacity 0
    expect(previewButton.style.opacity).toBe('0');
    expect(previewButton.style.background).toBe('rgba(0, 0, 0, 0)');

    // Find the cover container (the div with mouse events)
    // In our implementation, it's the parent of the image and the button
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
