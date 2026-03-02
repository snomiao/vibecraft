import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import GlobalChat from '../../../src/renderer/components/GlobalChat';
import type { Agent, AgentConnectEventPayload } from '../../../src/shared/types';

// Helper to create a minimal agent for testing
const createTestAgent = (id: string, displayName: string): Agent => ({
  id,
  name: displayName,
  displayName,
  provider: 'claude',
  model: 'test-model',
  color: '#ff0000',
  workspacePath: '/test/workspace',
  x: 0,
  y: 0,
  status: 'online',
});

// Store the event handler so we can trigger events in tests
let agentConnectEventHandler: ((payload: AgentConnectEventPayload) => void) | null = null;

beforeEach(() => {
  // Mock the electronAPI event subscription
  window.electronAPI.onAgentConnectEvent = vi.fn((handler) => {
    agentConnectEventHandler = handler;
    return () => {
      agentConnectEventHandler = null;
    };
  });
});

afterEach(() => {
  cleanup();
  agentConnectEventHandler = null;
});

// Helper to generate fake messages via agent connect events
let testRunCounter = 0;
const simulateAgentMessage = (agentId: string, content: string) => {
  if (!agentConnectEventHandler) return;

  // Use the same runId for both message and final events
  const runId = `test-run-${Date.now()}-${testRunCounter++}`;

  // First send the message event
  agentConnectEventHandler({
    runId,
    unit: { type: 'agent', id: agentId },
    event: {
      type: 'message',
      role: 'assistant',
      content,
    },
  });

  // Then send the final event to trigger display
  agentConnectEventHandler({
    runId,
    unit: { type: 'agent', id: agentId },
    event: {
      type: 'final',
      sessionId: 'test-session',
      cancelled: false,
    },
  });
};

const simulateHeroMessage = (content: string) => {
  if (!agentConnectEventHandler) return;

  agentConnectEventHandler({
    runId: `test-hero-run-${Date.now()}-${Math.random()}`,
    unit: { type: 'hero', id: 'hero' },
    event: {
      type: 'message',
      role: 'assistant',
      content,
    },
  });
};

// Generate a message of approximately the given size in characters
const generateMessage = (index: number, size: number = 500): string => {
  const base = `Message ${index}: `;
  const padding = 'x'.repeat(Math.max(0, size - base.length));
  return base + padding;
};

describe('GlobalChat', () => {
  describe('history truncation', () => {
    test('keeps messages under MAX_HISTORY_SIZE limit', async () => {
      const agents = [createTestAgent('agent-1', 'Test Agent')];

      render(
        <GlobalChat isVisible={true} onToggle={vi.fn()} agents={agents} heroName="Hero" heroId="hero" />
      );

      // Wait for the component to mount and subscribe to events
      await waitFor(() => {
        expect(agentConnectEventHandler).not.toBeNull();
      });

      // Send 300 messages (more than MAX_HISTORY_SIZE of 250)
      const messageCount = 300;

      await act(async () => {
        for (let i = 0; i < messageCount; i++) {
          simulateAgentMessage('agent-1', generateMessage(i));
        }
      });

      // Open the chat to see the history
      const historyContainer = document.querySelector('.global-chat-messages');

      // Count messages in the DOM
      const renderedMessages = historyContainer?.querySelectorAll('.global-chat-message');
      const renderedCount = renderedMessages?.length ?? 0;

      // Should be capped at 250 (MAX_HISTORY_SIZE)
      expect(renderedCount).toBeLessThanOrEqual(250);
      expect(renderedCount).toBeGreaterThan(0);

      // Verify the most recent messages are kept (not the oldest)
      // With column-reverse rendering, DOM order is reversed from visual order:
      // DOM index 0 = newest message (visually at bottom)
      // DOM index N-1 = oldest kept message (visually at top)
      const newestMessage = renderedMessages?.[0];
      expect(newestMessage?.textContent).toContain('Message 299');

      // The oldest kept message should be Message 50 (300 - 250)
      const oldestKeptMessage = renderedMessages?.[renderedCount - 1];
      expect(oldestKeptMessage?.textContent).toContain('Message 50');
    });

    test('handles rapid message bursts without crashing', async () => {
      const agents = [createTestAgent('agent-1', 'Test Agent'), createTestAgent('agent-2', 'Test Agent 2')];

      render(
        <GlobalChat isVisible={true} onToggle={vi.fn()} agents={agents} heroName="Hero" heroId="hero" />
      );

      await waitFor(() => {
        expect(agentConnectEventHandler).not.toBeNull();
      });

      await act(async () => {
        for (let i = 0; i < 500; i++) {
          // Alternate between agents and include some hero messages
          if (i % 3 === 0) {
            simulateHeroMessage(generateMessage(i, 300));
          } else if (i % 2 === 0) {
            simulateAgentMessage('agent-1', generateMessage(i, 800));
          } else {
            simulateAgentMessage('agent-2', generateMessage(i, 600));
          }
        }
      });

      // Verify messages are still capped
      const historyContainer = document.querySelector('.global-chat-messages');
      const renderedMessages = historyContainer?.querySelectorAll('.global-chat-message');
      expect(renderedMessages?.length).toBeLessThanOrEqual(250);
    });

    test('preserves message order during truncation', async () => {
      const agents = [createTestAgent('agent-1', 'Agent 1')];

      render(
        <GlobalChat isVisible={true} onToggle={vi.fn()} agents={agents} heroName="Hero" heroId="hero" />
      );

      await waitFor(() => {
        expect(agentConnectEventHandler).not.toBeNull();
      });

      // Send exactly 260 messages
      await act(async () => {
        for (let i = 0; i < 260; i++) {
          simulateAgentMessage('agent-1', `Sequential message ${i.toString().padStart(3, '0')}`);
        }
      });

      const historyContainer = document.querySelector('.global-chat-messages');
      const renderedMessages = historyContainer?.querySelectorAll('.global-chat-message');

      // Should have exactly 250 messages
      expect(renderedMessages?.length).toBe(250);

      // Verify chronological order is maintained
      // With column-reverse rendering, DOM index 0 = newest, DOM index 249 = oldest kept
      // Newest message should be #259
      // Oldest kept message should be #10 (260 - 250 = 10)
      const newestMessageText = renderedMessages?.[0]?.textContent ?? '';
      const oldestKeptMessageText = renderedMessages?.[249]?.textContent ?? '';

      expect(newestMessageText).toContain('259');
      expect(oldestKeptMessageText).toContain('010');

      // Check intermediate messages for order (DOM index 125 = message 259 - 125 = 134)
      const midMessageText = renderedMessages?.[125]?.textContent ?? '';
      expect(midMessageText).toContain('134');
    });

    test('does not truncate when under the limit', async () => {
      const agents = [createTestAgent('agent-1', 'Agent 1')];

      render(
        <GlobalChat isVisible={true} onToggle={vi.fn()} agents={agents} heroName="Hero" heroId="hero" />
      );

      await waitFor(() => {
        expect(agentConnectEventHandler).not.toBeNull();
      });

      // Send exactly 100 messages (under the 250 limit)
      await act(async () => {
        for (let i = 0; i < 100; i++) {
          simulateAgentMessage('agent-1', `Message ${i}`);
        }
      });

      const historyContainer = document.querySelector('.global-chat-messages');
      const renderedMessages = historyContainer?.querySelectorAll('.global-chat-message');

      // Should have all 100 messages
      expect(renderedMessages?.length).toBe(100);

      // With column-reverse rendering:
      // DOM index 0 = newest (Message 99)
      // DOM index 99 = oldest (Message 0)
      expect(renderedMessages?.[0]?.textContent).toContain('Message 99');
      expect(renderedMessages?.[99]?.textContent).toContain('Message 0');
    });

    test('memory footprint stays reasonable with large messages', async () => {
      const agents = [createTestAgent('agent-1', 'Agent 1')];

      render(
        <GlobalChat isVisible={true} onToggle={vi.fn()} agents={agents} heroName="Hero" heroId="hero" />
      );

      await waitFor(() => {
        expect(agentConnectEventHandler).not.toBeNull();
      });

      // Send 300 large messages (2KB each - simulating verbose agent responses)
      await act(async () => {
        for (let i = 0; i < 300; i++) {
          simulateAgentMessage('agent-1', generateMessage(i, 2000));
        }
      });

      const historyContainer = document.querySelector('.global-chat-messages');
      const renderedMessages = historyContainer?.querySelectorAll('.global-chat-message');

      // Should still be capped at 250
      expect(renderedMessages?.length).toBeLessThanOrEqual(250);

      // Calculate approximate text content size (rough estimate)
      let totalTextLength = 0;
      renderedMessages?.forEach((msg) => {
        totalTextLength += msg.textContent?.length ?? 0;
      });

      // With 250 messages at ~2KB each, total should be ~500KB of text
      // Adding some overhead for DOM structure, should still be under 1MB
      // The text content includes timestamps and agent names, so multiply by 2 for safety
      const estimatedBytes = totalTextLength * 2; // UTF-16

      // Should be reasonable (under 2MB for the text content)
      expect(estimatedBytes).toBeLessThan(2 * 1024 * 1024);
    });
  });
});
