import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import TokenFloater from '../../../src/renderer/components/canvas/TokenFloater';
import type { AgentConnectEventPayload } from '../../../src/shared/types';

let eventHandler: ((payload: AgentConnectEventPayload) => void) | null = null;

beforeEach(() => {
  window.electronAPI.onAgentConnectEvent = vi.fn((handler) => {
    eventHandler = handler;
    return () => {
      eventHandler = null;
    };
  });
});

afterEach(() => {
  eventHandler = null;
  cleanup();
});

const emitUsage = (agentId: string, totalTokens: number) => {
  eventHandler?.({
    runId: 'run-1',
    unit: { type: 'agent', id: agentId },
    event: {
      type: 'usage',
      usage: { total_tokens: totalTokens },
    },
  });
};

const emitMessage = (agentId: string, totalTokens: number) => {
  eventHandler?.({
    runId: 'run-1',
    unit: { type: 'agent', id: agentId },
    event: {
      type: 'message',
      role: 'assistant',
      content: 'hello',
      usage: { input_tokens: totalTokens - 100, output_tokens: 100, total_tokens: totalTokens },
    },
  });
};

describe('TokenFloater', () => {
  test('spawns a floater when a usage event arrives for the matching agent', () => {
    const { container } = render(<TokenFloater agentId="agent-1" reduceEffects={false} />);
    const floaterContainer = container.querySelector('.token-floater-container')!;
    expect(floaterContainer).toBeTruthy();

    emitUsage('agent-1', 5000);

    const floaters = floaterContainer.querySelectorAll('.token-floater');
    expect(floaters).toHaveLength(1);
    expect(floaters[0].textContent).toBe('+5.0k');
  });

  test('ignores events for a different agent', () => {
    const { container } = render(<TokenFloater agentId="agent-1" reduceEffects={false} />);
    const floaterContainer = container.querySelector('.token-floater-container')!;

    emitUsage('agent-other', 5000);

    expect(floaterContainer.querySelectorAll('.token-floater')).toHaveLength(0);
  });

  test('ignores hero events', () => {
    const { container } = render(<TokenFloater agentId="agent-1" reduceEffects={false} />);
    const floaterContainer = container.querySelector('.token-floater-container')!;

    eventHandler?.({
      runId: 'run-1',
      unit: { type: 'hero', id: 'hero' },
      event: { type: 'usage', usage: { total_tokens: 1000 } },
    });

    expect(floaterContainer.querySelectorAll('.token-floater')).toHaveLength(0);
  });

  test('spawns a floater from message events with usage', () => {
    const { container } = render(<TokenFloater agentId="agent-1" reduceEffects={false} />);
    const floaterContainer = container.querySelector('.token-floater-container')!;

    emitMessage('agent-1', 2500);

    const floaters = floaterContainer.querySelectorAll('.token-floater');
    expect(floaters).toHaveLength(1);
    expect(floaters[0].textContent).toBe('+2.5k');
  });

  test('spawns a floater from final events with usage', () => {
    const { container } = render(<TokenFloater agentId="agent-1" reduceEffects={false} />);
    const floaterContainer = container.querySelector('.token-floater-container')!;

    eventHandler?.({
      runId: 'run-1',
      unit: { type: 'agent', id: 'agent-1' },
      event: { type: 'final', usage: { total_tokens: 800 } },
    });

    const floaters = floaterContainer.querySelectorAll('.token-floater');
    expect(floaters).toHaveLength(1);
    expect(floaters[0].textContent).toBe('+800');
  });

  test('does not spawn floaters for non-usage event types', () => {
    const { container } = render(<TokenFloater agentId="agent-1" reduceEffects={false} />);
    const floaterContainer = container.querySelector('.token-floater-container')!;

    eventHandler?.({
      runId: 'run-1',
      unit: { type: 'agent', id: 'agent-1' },
      event: { type: 'status', status: 'thinking' },
    });

    eventHandler?.({
      runId: 'run-1',
      unit: { type: 'agent', id: 'agent-1' },
      event: { type: 'delta', text: 'hello' },
    });

    expect(floaterContainer.querySelectorAll('.token-floater')).toHaveLength(0);
  });

  test('caps floaters at MAX_FLOATERS (4)', () => {
    const { container } = render(<TokenFloater agentId="agent-1" reduceEffects={false} />);
    const floaterContainer = container.querySelector('.token-floater-container')!;

    for (let i = 0; i < 6; i++) {
      emitUsage('agent-1', 1000 * (i + 1));
    }

    expect(floaterContainer.querySelectorAll('.token-floater')).toHaveLength(4);
  });

  test('removes floater on animationend and allows new ones', () => {
    const { container } = render(<TokenFloater agentId="agent-1" reduceEffects={false} />);
    const floaterContainer = container.querySelector('.token-floater-container')!;

    emitUsage('agent-1', 1000);
    expect(floaterContainer.querySelectorAll('.token-floater')).toHaveLength(1);

    const floater = floaterContainer.querySelector('.token-floater')!;
    floater.dispatchEvent(new Event('animationend'));

    expect(floaterContainer.querySelectorAll('.token-floater')).toHaveLength(0);

    // Can spawn new ones after cleanup
    emitUsage('agent-1', 2000);
    expect(floaterContainer.querySelectorAll('.token-floater')).toHaveLength(1);
  });

  test('renders nothing when reduceEffects is true', () => {
    const { container } = render(<TokenFloater agentId="agent-1" reduceEffects={true} />);

    expect(container.querySelector('.token-floater-container')).toBeNull();
  });

  test('resets floater capacity when reduceEffects toggles on and back off', () => {
    const { container, rerender } = render(<TokenFloater agentId="agent-1" reduceEffects={false} />);
    const initialContainer = container.querySelector('.token-floater-container')!;

    for (let i = 0; i < 4; i += 1) {
      emitUsage('agent-1', 1000 * (i + 1));
    }
    expect(initialContainer.querySelectorAll('.token-floater')).toHaveLength(4);

    rerender(<TokenFloater agentId="agent-1" reduceEffects={true} />);
    expect(container.querySelector('.token-floater-container')).toBeNull();

    rerender(<TokenFloater agentId="agent-1" reduceEffects={false} />);
    const resumedContainer = container.querySelector('.token-floater-container')!;
    emitUsage('agent-1', 9000);

    expect(resumedContainer.querySelectorAll('.token-floater')).toHaveLength(1);
    expect(resumedContainer.querySelector('.token-floater')?.textContent).toBe('+9.0k');
  });

  test('does not subscribe to events when reduceEffects is true', () => {
    render(<TokenFloater agentId="agent-1" reduceEffects={true} />);

    expect(eventHandler).toBeNull();
  });

  test('formats large token values correctly', () => {
    const { container } = render(<TokenFloater agentId="agent-1" reduceEffects={false} />);
    const floaterContainer = container.querySelector('.token-floater-container')!;

    emitUsage('agent-1', 1_500_000);

    const floaters = floaterContainer.querySelectorAll('.token-floater');
    expect(floaters).toHaveLength(1);
    expect(floaters[0].textContent).toBe('+1.5m');
  });

  test('ignores usage events with zero tokens', () => {
    const { container } = render(<TokenFloater agentId="agent-1" reduceEffects={false} />);
    const floaterContainer = container.querySelector('.token-floater-container')!;

    emitUsage('agent-1', 0);

    expect(floaterContainer.querySelectorAll('.token-floater')).toHaveLength(0);
  });

  test('unsubscribes from events on unmount', () => {
    const { unmount } = render(<TokenFloater agentId="agent-1" reduceEffects={false} />);
    expect(eventHandler).not.toBeNull();

    unmount();
    expect(eventHandler).toBeNull();
  });

  test('spawns floaters throughout a multi-turn agent run', () => {
    const { container } = render(<TokenFloater agentId="agent-1" reduceEffects={false} />);
    const floaterContainer = container.querySelector('.token-floater-container')!;

    // Turn 1: agent thinks, then completes a message with usage
    eventHandler?.({
      runId: 'run-1',
      unit: { type: 'agent', id: 'agent-1' },
      event: { type: 'status', status: 'thinking' },
    });
    expect(floaterContainer.querySelectorAll('.token-floater')).toHaveLength(0);

    eventHandler?.({
      runId: 'run-1',
      unit: { type: 'agent', id: 'agent-1' },
      event: { type: 'delta', text: 'Let me read the file...' },
    });
    expect(floaterContainer.querySelectorAll('.token-floater')).toHaveLength(0);

    // Message completes with usage — first floater
    emitMessage('agent-1', 3000);
    expect(floaterContainer.querySelectorAll('.token-floater')).toHaveLength(1);
    expect(floaterContainer.querySelector('.token-floater')!.textContent).toBe('+3.0k');

    // Tool call happens (no usage)
    eventHandler?.({
      runId: 'run-1',
      unit: { type: 'agent', id: 'agent-1' },
      event: { type: 'tool_call', phase: 'start', callId: 'call-1', name: 'Read' },
    });
    expect(floaterContainer.querySelectorAll('.token-floater')).toHaveLength(1);

    // Turn 2: another assistant message with usage — second floater
    emitMessage('agent-1', 4500);
    expect(floaterContainer.querySelectorAll('.token-floater')).toHaveLength(2);

    // Usage event mid-run — third floater
    emitUsage('agent-1', 1200);
    expect(floaterContainer.querySelectorAll('.token-floater')).toHaveLength(3);

    // Final event with usage — fourth floater
    eventHandler?.({
      runId: 'run-1',
      unit: { type: 'agent', id: 'agent-1' },
      event: { type: 'final', usage: { total_tokens: 500 } },
    });
    expect(floaterContainer.querySelectorAll('.token-floater')).toHaveLength(4);
  });

  test('ignores message events without usage', () => {
    const { container } = render(<TokenFloater agentId="agent-1" reduceEffects={false} />);
    const floaterContainer = container.querySelector('.token-floater-container')!;

    eventHandler?.({
      runId: 'run-1',
      unit: { type: 'agent', id: 'agent-1' },
      event: { type: 'message', role: 'assistant', content: 'hello' },
    });

    expect(floaterContainer.querySelectorAll('.token-floater')).toHaveLength(0);
  });

  test('ignores final events without usage', () => {
    const { container } = render(<TokenFloater agentId="agent-1" reduceEffects={false} />);
    const floaterContainer = container.querySelector('.token-floater-container')!;

    eventHandler?.({
      runId: 'run-1',
      unit: { type: 'agent', id: 'agent-1' },
      event: { type: 'final' },
    });

    expect(floaterContainer.querySelectorAll('.token-floater')).toHaveLength(0);
  });
});
