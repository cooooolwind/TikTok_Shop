// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Playhead } from './Playhead';

describe('Playhead', () => {
  it('拖动时只更新草稿位置，松开后提交一次最终秒数', () => {
    const onSeek = vi.fn();
    const onSeekStart = vi.fn();
    const onSeekEnd = vi.fn();

    render(
      <div style={{ width: 400, position: 'relative' }}>
        <Playhead
          seconds={1}
          pixelsPerSecond={100}
          totalDuration={5}
          onSeek={onSeek}
          onSeekStart={onSeekStart}
          onSeekEnd={onSeekEnd}
        />
      </div>,
    );

    const dragger = screen.getByTestId('playhead-dragger');
    Object.defineProperty(dragger.parentElement?.parentElement, 'getBoundingClientRect', {
      value: () => ({ left: 0, right: 400, width: 400, top: 0, bottom: 100, height: 100 }),
    });

    fireEvent.mouseDown(dragger);
    fireEvent.mouseMove(document, { clientX: 220 });
    fireEvent.mouseMove(document, { clientX: 260 });
    fireEvent.mouseUp(document);

    expect(onSeekStart).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledTimes(2);
    expect(onSeekEnd).toHaveBeenCalledTimes(1);
    expect(onSeekEnd).toHaveBeenCalledWith(2.6);
  });
});
