import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import DetailsPanel from '../../../src/renderer/components/hud/DetailsPanel';
import type { WorldEntity } from '../../../src/shared/types';

const baseHero = {
  id: 'hero',
  name: 'Davion',
  provider: 'claude',
  model: '',
  x: 100,
  y: 200,
  type: 'hero',
  entityKind: 'unit',
} satisfies WorldEntity;

const baseAgent = {
  id: 'agent-1',
  provider: 'claude',
  model: '',
  color: '#ff0000',
  name: 'Claude',
  displayName: 'Claude',
  workspacePath: '/workspace',
  x: 50,
  y: 75,
  status: 'online',
  type: 'agent',
  entityKind: 'unit',
} satisfies WorldEntity;

describe('DetailsPanel', () => {
  afterEach(() => {
    cleanup();
  });

  test('commits hero name edits on blur', () => {
    const onHeroNameCommit = vi.fn();
    render(<DetailsPanel entity={baseHero} terminalProcess={null} onHeroNameCommit={onHeroNameCommit} />);

    const input = screen.getByDisplayValue('Davion');
    fireEvent.change(input, { target: { value: 'Mirana' } });
    fireEvent.blur(input);

    expect(onHeroNameCommit).toHaveBeenCalledWith('Mirana');
  });

  test('trims hero name input and skips empty names', () => {
    const onHeroNameCommit = vi.fn();
    render(<DetailsPanel entity={baseHero} terminalProcess={null} onHeroNameCommit={onHeroNameCommit} />);

    const input = screen.getByDisplayValue('Davion');
    fireEvent.change(input, { target: { value: '  Riki  ' } });
    fireEvent.blur(input);
    expect(onHeroNameCommit).toHaveBeenCalledWith('Riki');

    onHeroNameCommit.mockClear();
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(onHeroNameCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('Davion');
  });

  test('skips hero name commit when unchanged', () => {
    const onHeroNameCommit = vi.fn();
    render(<DetailsPanel entity={baseHero} terminalProcess={null} onHeroNameCommit={onHeroNameCommit} />);

    const input = screen.getByDisplayValue('Davion');
    fireEvent.change(input, { target: { value: '  Davion  ' } });
    fireEvent.blur(input);
    expect(onHeroNameCommit).not.toHaveBeenCalled();
  });

  test('commits agent name edits on blur', () => {
    const onAgentNameCommit = vi.fn();
    render(<DetailsPanel entity={baseAgent} terminalProcess={null} onAgentNameCommit={onAgentNameCommit} />);

    const input = screen.getByDisplayValue('Claude');
    fireEvent.change(input, { target: { value: 'Scout' } });
    fireEvent.blur(input);

    expect(onAgentNameCommit).toHaveBeenCalledWith('agent-1', 'Scout');
  });

  test('trims agent name input and skips empty names', () => {
    const onAgentNameCommit = vi.fn();
    render(<DetailsPanel entity={baseAgent} terminalProcess={null} onAgentNameCommit={onAgentNameCommit} />);

    const input = screen.getByDisplayValue('Claude');
    fireEvent.change(input, { target: { value: '  Sage  ' } });
    fireEvent.blur(input);
    expect(onAgentNameCommit).toHaveBeenCalledWith('agent-1', 'Sage');

    onAgentNameCommit.mockClear();
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(onAgentNameCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('Claude');
  });

  test('skips agent name commit when unchanged', () => {
    const onAgentNameCommit = vi.fn();
    render(<DetailsPanel entity={baseAgent} terminalProcess={null} onAgentNameCommit={onAgentNameCommit} />);

    const input = screen.getByDisplayValue('Claude');
    fireEvent.change(input, { target: { value: '  Claude  ' } });
    fireEvent.blur(input);
    expect(onAgentNameCommit).not.toHaveBeenCalled();
  });
});
