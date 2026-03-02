import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BrowserEntity from '../../../src/renderer/components/canvas/BrowserEntity';
import HeroEntity from '../../../src/renderer/components/canvas/HeroEntity';
import FolderEntity from '../../../src/renderer/components/canvas/FolderEntity';

const noop = () => {};
const noopMove = () => {};

describe('entity selection indicators', () => {
  it('renders a selection circle for units when selected', () => {
    const { container } = render(
      <HeroEntity
        hero={{
          id: 'hero',
          name: 'Hero',
          provider: 'claude',
          model: 'claude-3.5',
          x: 0,
          y: 0,
        }}
        selected
        onSelect={noop}
        onMove={noopMove}
      />
    );

    expect(container.querySelector('.selection-circle')).toBeTruthy();
    expect(container.querySelector('.selection-ring')).toBeNull();
  });

  it('renders a selection ring for folders when selected', () => {
    const { container } = render(
      <FolderEntity
        folder={{
          kind: 'folder',
          id: 'folder-1',
          name: 'Folder',
          relativePath: 'Folder',
          x: 0,
          y: 0,
          createdAt: Date.now(),
        }}
        selected
        onSelect={noop}
        onMove={noopMove}
      />
    );

    expect(container.querySelector('.selection-ring')).toBeTruthy();
    expect(container.querySelector('.selection-circle')).toBeNull();
  });

  it('does not render a selection ring for windowed buildings', () => {
    const { container } = render(
      <BrowserEntity
        panel={{
          id: 'browser-1',
          url: 'https://example.com',
          x: 0,
          y: 0,
          width: 640,
          height: 480,
          createdAt: 0,
        }}
        selected
        onSelect={noop}
        onMove={noopMove}
      />
    );

    const wrapper = container.querySelector('.browser-entity-wrapper');
    expect(wrapper).toBeTruthy();
    expect(wrapper?.classList.contains('selected')).toBe(true);
    expect(container.querySelector('.selection-ring')).toBeNull();
    expect(container.querySelector('.selection-circle')).toBeNull();
  });

  it('renders a selection shield for windowed buildings during drag selection', () => {
    const { container } = render(
      <BrowserEntity
        panel={{
          id: 'browser-2',
          url: 'https://example.com',
          x: 0,
          y: 0,
          width: 640,
          height: 480,
          createdAt: 0,
        }}
        selected={false}
        dragSelecting
        onSelect={noop}
        onMove={noopMove}
      />
    );

    expect(container.querySelector('.windowed-selection-shield')).toBeTruthy();
  });
});
