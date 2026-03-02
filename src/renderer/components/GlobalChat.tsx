import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { Agent, AgentConnectEventPayload } from '../../shared/types';
import './GlobalChat.css';

interface ChatMessage {
  id: string;
  text: string;
  timestamp: number;
  type: 'user' | 'system' | 'agent' | 'hero';
  unitName?: string;
  unitColor?: string;
}

interface OverlayMessage extends ChatMessage {
  expiring: boolean;
}

// Track active runs initiated from global chat
interface PendingRun {
  runId: string;
  unitId: string;
  unitType: 'agent' | 'hero';
  unitName: string;
  unitColor?: string;
  lastMessage?: string;
}

interface MentionOption {
  id: string;
  name: string;
  displayName: string;
  type: 'agent' | 'hero';
  isAttached: boolean;
}

export interface MentionedUnit {
  id: string;
  type: 'agent' | 'hero';
  displayName: string;
  isAttached: boolean;
}

// A segment in the input - either plain text or a mention block
type InputSegment = { type: 'text'; content: string } | { type: 'mention'; unit: MentionedUnit };

interface GlobalChatProps {
  isVisible: boolean;
  onToggle: (visible: boolean) => void;
  agents: Agent[];
  heroName?: string;
  heroId?: string;
  onSubmitMessage?: (text: string, mentionedUnits: MentionedUnit[], runIds: Map<string, string>) => void;
  prefillMentions?: MentionedUnit[];
  prefillText?: string;
  submitTextOverride?: string;
  displayTextOverride?: string;
  maxSubmits?: number;
  submitGateKey?: string;
  closeOnSubmit?: boolean;
}

const OVERLAY_FADE_START_MS = 5000;
const OVERLAY_FADE_DURATION_MS = 500;
const MAX_HISTORY_SIZE = 250;

// Counter for unique message IDs (handles rapid message creation)
let messageIdCounter = 0;
const createMessageId = (prefix: string): string => {
  messageIdCounter += 1;
  return `${prefix}-${Date.now()}-${messageIdCounter}`;
};

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// Convert segments to display text
const segmentsToDisplayText = (segments: InputSegment[]): string => {
  return segments.map((seg) => (seg.type === 'text' ? seg.content : `@${seg.unit.displayName}`)).join('');
};

// Extract all mentions from segments
const getMentionsFromSegments = (segments: InputSegment[]): MentionedUnit[] => {
  return segments
    .filter((seg): seg is { type: 'mention'; unit: MentionedUnit } => seg.type === 'mention')
    .map((seg) => seg.unit);
};

export default function GlobalChat({
  isVisible,
  onToggle,
  agents,
  heroName = 'Hero',
  heroId = 'hero',
  onSubmitMessage,
  prefillMentions = [],
  prefillText,
  submitTextOverride,
  displayTextOverride,
  maxSubmits,
  submitGateKey,
  closeOnSubmit = true,
}: GlobalChatProps) {
  // The input is represented as a sequence of segments
  const [segments, setSegments] = useState<InputSegment[]>([{ type: 'text', content: '' }]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [overlayMessages, setOverlayMessages] = useState<OverlayMessage[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const submitCountRef = useRef(0);
  const submitGateKeyRef = useRef<string | null>(null);

  // Add a message to history with truncation to prevent unbounded growth
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      const updated = [...prev, message];
      if (updated.length > MAX_HISTORY_SIZE) {
        return updated.slice(-MAX_HISTORY_SIZE);
      }
      return updated;
    });
  }, []);

  useEffect(() => {
    const nextKey = submitGateKey ?? null;
    if (submitGateKeyRef.current !== nextKey) {
      submitGateKeyRef.current = nextKey;
      submitCountRef.current = 0;
    }
  }, [submitGateKey]);
  const [autocompleteOptions, setAutocompleteOptions] = useState<MentionOption[]>([]);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);

  // Track pending runs initiated from this chat (to know which responses to display)
  const pendingRunsRef = useRef<Map<string, PendingRun>>(new Map());
  const agentsRef = useRef<Agent[]>(agents);
  const heroNameRef = useRef(heroName);

  // Drag state for repositioning the chat
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const overlayTimersRef = useRef<Map<string, { fadeTimer: NodeJS.Timeout; hideTimer: NodeJS.Timeout }>>(
    new Map()
  );

  // Track the last message content per run (by runId) for displaying on final
  // Using runId instead of agentId prevents issues with overlapping runs for the same agent
  const agentLastMessageRef = useRef<Map<string, string>>(new Map());
  const agentRenderedMessageRef = useRef<Map<string, string>>(new Map());
  const heroLastMessageRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    heroNameRef.current = heroName;
  }, [heroName]);

  // Build mention options from agents and hero
  const mentionOptions = useMemo<MentionOption[]>(() => {
    const options: MentionOption[] = [];

    options.push({
      id: heroId,
      name: heroName,
      displayName: heroName,
      type: 'hero' as const,
      isAttached: true,
    });

    for (const agent of agents) {
      options.push({
        id: agent.id,
        name: agent.displayName,
        displayName: agent.displayName,
        type: 'agent' as const,
        isAttached: !!agent.attachedFolderId,
      });
    }

    return options;
  }, [agents, heroId, heroName]);

  // Get already mentioned unit IDs
  const mentionedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const seg of segments) {
      if (seg.type === 'mention') {
        ids.add(seg.unit.id);
      }
    }
    return ids;
  }, [segments]);

  const focusEditorAtEnd = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const renderSegmentsToEditor = useCallback((segmentsToRender: InputSegment[]) => {
    if (!editorRef.current) return;

    editorRef.current.innerHTML = '';

    for (const segment of segmentsToRender) {
      if (segment.type === 'text') {
        const textNode = document.createTextNode(segment.content);
        editorRef.current.appendChild(textNode);
      } else {
        const chip = document.createElement('span');
        chip.className = `mention-chip ${segment.unit.type}`;
        chip.contentEditable = 'false';
        chip.dataset.unit = JSON.stringify(segment.unit);
        chip.textContent = `@${segment.unit.displayName}`;
        editorRef.current.appendChild(chip);
      }
    }
  }, []);

  // Apply prefill when opening
  useEffect(() => {
    if (!isVisible) return;
    if (prefillMentions.length === 0 && !prefillText) return;
    const newSegments: InputSegment[] = [];

    for (let i = 0; i < prefillMentions.length; i++) {
      newSegments.push({ type: 'mention', unit: prefillMentions[i] });
      newSegments.push({ type: 'text', content: ' ' });
    }

    if (prefillText) {
      newSegments.push({ type: 'text', content: prefillText });
    } else {
      newSegments.push({ type: 'text', content: '' });
    }

    setSegments(newSegments);
    renderSegmentsToEditor(newSegments);
    focusEditorAtEnd();
  }, [focusEditorAtEnd, isVisible, prefillMentions, prefillText, renderSegmentsToEditor]);

  // Focus editor when becoming visible
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        focusEditorAtEnd();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [focusEditorAtEnd, isVisible]);

  // Add a message to the overlay with auto-fade timers
  const addOverlayMessage = useCallback((message: ChatMessage) => {
    const overlayMsg: OverlayMessage = { ...message, expiring: false };
    setOverlayMessages((prev) => [...prev, overlayMsg]);

    // Set up timers for this specific message
    const fadeTimer = setTimeout(() => {
      setOverlayMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, expiring: true } : m)));
    }, OVERLAY_FADE_START_MS);

    const hideTimer = setTimeout(() => {
      setOverlayMessages((prev) => prev.filter((m) => m.id !== message.id));
      overlayTimersRef.current.delete(message.id);
    }, OVERLAY_FADE_START_MS + OVERLAY_FADE_DURATION_MS);

    overlayTimersRef.current.set(message.id, { fadeTimer, hideTimer });
  }, []);

  // Cleanup overlay timers on unmount
  useEffect(() => {
    const timers = overlayTimersRef.current;
    return () => {
      for (const { fadeTimer, hideTimer } of timers.values()) {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      }
    };
  }, []);

  // Subscribe to agent connect events to receive responses
  useEffect(() => {
    const handleAgentConnectEvent = (payload: AgentConnectEventPayload) => {
      const { runId, unit, event } = payload;

      // For agents: track all runs (regardless of source) and display final message
      if (unit.type === 'agent') {
        if (event.type === 'message' && event.role === 'assistant') {
          // Store the latest message content per run - we'll display it on final
          // Using runId (not unit.id) prevents issues with overlapping runs
          agentLastMessageRef.current.set(runId, event.content);
          const pendingRun = pendingRunsRef.current.get(runId);
          if (pendingRun) {
            pendingRun.lastMessage = event.content;
          }
        }

        // On final, display the last message received for this run
        if (event.type === 'final') {
          const lastMessage = agentLastMessageRef.current.get(runId);
          const pendingRun = pendingRunsRef.current.get(runId);
          if (lastMessage) {
            // Look up agent name from the agents prop
            const agent = agentsRef.current.find((a) => a.id === unit.id);
            const unitName = agent?.displayName ?? 'Agent';

            const message: ChatMessage = {
              id: createMessageId(`agent-${runId}`),
              text: lastMessage,
              timestamp: Date.now(),
              type: 'agent',
              unitName,
              unitColor: '#7dd3fc',
            };
            addMessage(message);
            addOverlayMessage(message);
          }
          agentLastMessageRef.current.delete(runId);
          agentRenderedMessageRef.current.delete(runId);

          // Clean up pending run if this was initiated from global chat
          if (pendingRun) {
            pendingRunsRef.current.delete(runId);
          }
        }
      }

      // For hero: display the final message only
      if (unit.type === 'hero') {
        if (event.type === 'message' && event.role === 'assistant') {
          heroLastMessageRef.current.set(runId, event.content);
          const pendingRun = pendingRunsRef.current.get(runId);
          if (pendingRun) {
            pendingRun.lastMessage = event.content;
          }
        }

        // Clean up pending run if this was initiated from global chat
        if (event.type === 'final') {
          const lastMessage = heroLastMessageRef.current.get(runId);
          const pendingRun = pendingRunsRef.current.get(runId);
          if (lastMessage) {
            const message: ChatMessage = {
              id: createMessageId(`hero-${runId}`),
              text: lastMessage,
              timestamp: Date.now(),
              type: 'hero',
              unitName: heroNameRef.current,
              unitColor: '#fcd34d',
            };
            addMessage(message);
            addOverlayMessage(message);
          }
          heroLastMessageRef.current.delete(runId);
          if (pendingRun) {
            pendingRunsRef.current.delete(runId);
          }
        }
      }
    };

    const cleanup = window.electronAPI.onAgentConnectEvent(handleAgentConnectEvent);
    return () => cleanup();
  }, [addMessage, addOverlayMessage]);

  // Drag handlers for repositioning the chat
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      // Don't start drag from the editor or autocomplete
      const target = e.target as HTMLElement;
      if (target.closest('.global-chat-editor') || target.closest('.global-chat-autocomplete')) {
        return;
      }

      e.preventDefault();
      setIsDragging(true);

      const currentPos = position ?? { x: 0, y: 0 };
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        posX: currentPos.x,
        posY: currentPos.y,
      };
    },
    [position]
  );

  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return;

      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      setPosition({
        x: dragStartRef.current.posX + deltaX,
        y: dragStartRef.current.posY + deltaY,
      });
    },
    [isDragging]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // Add/remove global mouse listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Parse the current editor content back into segments
  const parseEditorContent = useCallback((): InputSegment[] => {
    if (!editorRef.current) return [{ type: 'text', content: '' }];

    const newSegments: InputSegment[] = [];
    const childNodes = editorRef.current.childNodes;

    for (let i = 0; i < childNodes.length; i++) {
      const node = childNodes[i];

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text) {
          // Merge with previous text segment if possible
          const last = newSegments[newSegments.length - 1];
          if (last && last.type === 'text') {
            last.content += text;
          } else {
            newSegments.push({ type: 'text', content: text });
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.classList.contains('mention-chip')) {
          const unitData = el.dataset.unit;
          if (unitData) {
            try {
              const unit = JSON.parse(unitData) as MentionedUnit;
              newSegments.push({ type: 'mention', unit });
            } catch {
              // Invalid data, treat as text
              newSegments.push({ type: 'text', content: el.textContent || '' });
            }
          }
        } else {
          // Other elements - extract text content
          const text = el.textContent || '';
          if (text) {
            const last = newSegments[newSegments.length - 1];
            if (last && last.type === 'text') {
              last.content += text;
            } else {
              newSegments.push({ type: 'text', content: text });
            }
          }
        }
      }
    }

    // Ensure there's always at least one text segment
    if (newSegments.length === 0) {
      newSegments.push({ type: 'text', content: '' });
    }

    return newSegments;
  }, []);

  // Check for @mention trigger in text and show autocomplete
  const checkForMentionTrigger = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      setShowAutocomplete(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const node = range.startContainer;

    // Only trigger in text nodes
    if (node.nodeType !== Node.TEXT_NODE) {
      setShowAutocomplete(false);
      return;
    }

    const text = node.textContent || '';
    const cursorPos = range.startOffset;
    const textBeforeCursor = text.slice(0, cursorPos);

    // Look for @ followed by word characters
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = normalize(mentionMatch[1]);
      const filtered = mentionOptions.filter((opt) => {
        const normalizedName = normalize(opt.displayName);
        return normalizedName.includes(query) && !mentionedIds.has(opt.id);
      });
      setAutocompleteOptions(filtered);
      setShowAutocomplete(filtered.length > 0);
      setSelectedOptionIndex(0);
    } else {
      setShowAutocomplete(false);
    }
  }, [mentionOptions, mentionedIds]);

  // Insert a mention chip at the current cursor position
  const insertMention = useCallback(
    (option: MentionOption) => {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount || !editorRef.current) return;

      const range = selection.getRangeAt(0);
      const node = range.startContainer;

      if (node.nodeType !== Node.TEXT_NODE) return;

      const text = node.textContent || '';
      const cursorPos = range.startOffset;
      const textBeforeCursor = text.slice(0, cursorPos);

      // Find the @ trigger
      const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
      if (!mentionMatch || mentionMatch.index === undefined) return;

      const beforeAt = textBeforeCursor.slice(0, mentionMatch.index);
      const afterCursor = text.slice(cursorPos);

      // Create the mention unit
      const unit: MentionedUnit = {
        id: option.id,
        type: option.type,
        displayName: option.displayName,
        isAttached: option.isAttached,
      };

      // Create mention chip element
      const chip = document.createElement('span');
      chip.className = `mention-chip ${option.type}`;
      chip.contentEditable = 'false';
      chip.dataset.unit = JSON.stringify(unit);
      chip.textContent = `@${option.displayName}`;

      // Replace the text node with: beforeText + chip + space + afterText
      const parent = node.parentNode;
      if (!parent) return;

      const beforeText = document.createTextNode(beforeAt);
      const afterText = document.createTextNode(' ' + afterCursor);

      parent.insertBefore(beforeText, node);
      parent.insertBefore(chip, node);
      parent.insertBefore(afterText, node);
      parent.removeChild(node);

      // Set cursor after the space
      const newRange = document.createRange();
      newRange.setStart(afterText, 1);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);

      // Update segments state
      setSegments(parseEditorContent());
      setShowAutocomplete(false);
    },
    [parseEditorContent]
  );

  const handleSubmit = useCallback(() => {
    if (maxSubmits !== undefined && submitCountRef.current >= maxSubmits) {
      return;
    }
    const currentSegments = parseEditorContent();
    const displayText = segmentsToDisplayText(currentSegments).trim();
    const displayOverride = displayTextOverride?.trim();
    const displayTextForUser = (displayOverride || displayText).trim();
    const forcedText = submitTextOverride?.trim();
    const effectiveText = forcedText || displayTextForUser;
    if (!effectiveText) return;

    let mentions = getMentionsFromSegments(currentSegments);
    if (mentions.length === 0 && displayTextOverride && prefillMentions.length > 0) {
      mentions = prefillMentions;
    }
    let unattachedUnits = mentions.filter((u) => !u.isAttached);
    let attachedUnits = mentions.filter((u) => u.isAttached);
    if (attachedUnits.length === 0 && displayTextOverride && prefillMentions.length > 0) {
      attachedUnits = prefillMentions;
      unattachedUnits = [];
    }

    // Add user message to history and overlay
    const userMessage: ChatMessage = {
      id: createMessageId('user'),
      text: displayTextForUser || effectiveText,
      timestamp: Date.now(),
      type: 'user',
    };
    addMessage(userMessage);
    addOverlayMessage(userMessage);

    if (maxSubmits !== undefined) {
      submitCountRef.current += 1;
    }

    // Show warnings for unattached units
    for (const unit of unattachedUnits) {
      const warningMessage: ChatMessage = {
        id: createMessageId(`unattached-${unit.id}`),
        text: `@${unit.displayName} is not attached to a folder.`,
        timestamp: Date.now(),
        type: 'system',
      };
      addMessage(warningMessage);
      addOverlayMessage(warningMessage);
    }

    // If no mentions at all, show "empty ears" message (only in overlay, not history)
    if (mentions.length === 0) {
      const systemMessage: ChatMessage = {
        id: createMessageId('system'),
        text: 'But it fell on empty ears...',
        timestamp: Date.now(),
        type: 'system',
      };
      addOverlayMessage(systemMessage);
    } else if (attachedUnits.length > 0) {
      // Generate run IDs and register pending runs
      const runIds = new Map<string, string>();
      for (const unit of attachedUnits) {
        const runId = `global-chat-${unit.type}-${unit.id}-${Date.now()}`;
        runIds.set(unit.id, runId);

        // Use default colors (hero is gold, agents are blue)
        const unitColor = unit.type === 'hero' ? '#fcd34d' : '#7dd3fc';

        pendingRunsRef.current.set(runId, {
          runId,
          unitId: unit.id,
          unitType: unit.type,
          unitName: unit.displayName,
          unitColor,
        });
      }

      onSubmitMessage?.(effectiveText, attachedUnits, runIds);
    }

    // Clear editor
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    setSegments([{ type: 'text', content: '' }]);
    setShowAutocomplete(false);
    if (closeOnSubmit) {
      onToggle(false);
    }
  }, [
    addMessage,
    addOverlayMessage,
    displayTextOverride,
    closeOnSubmit,
    maxSubmits,
    parseEditorContent,
    onSubmitMessage,
    onToggle,
    prefillMentions,
    submitTextOverride,
  ]);

  const handleInput = useCallback(() => {
    setSegments(parseEditorContent());
    checkForMentionTrigger();
  }, [parseEditorContent, checkForMentionTrigger]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Handle autocomplete navigation
      if (showAutocomplete) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelectedOptionIndex((prev) => (prev < autocompleteOptions.length - 1 ? prev + 1 : 0));
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSelectedOptionIndex((prev) => (prev > 0 ? prev - 1 : autocompleteOptions.length - 1));
          return;
        }
        if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey)) {
          event.preventDefault();
          if (autocompleteOptions[selectedOptionIndex]) {
            insertMention(autocompleteOptions[selectedOptionIndex]);
          }
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setShowAutocomplete(false);
          return;
        }
      }

      // Submit on Enter (without shift)
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        if (maxSubmits !== undefined && submitCountRef.current >= maxSubmits) {
          return;
        }
        const currentSegments = parseEditorContent();
        const displayText = segmentsToDisplayText(currentSegments).trim();
        const forcedText = submitTextOverride?.trim();
        if (displayText || forcedText) {
          handleSubmit();
        } else {
          // Empty input - just dismiss
          onToggle(false);
          if (editorRef.current) {
            editorRef.current.innerHTML = '';
          }
          setSegments([{ type: 'text', content: '' }]);
        }
        return;
      }

      // Close chat on Escape
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onToggle(false);
        if (editorRef.current) {
          editorRef.current.innerHTML = '';
        }
        setSegments([{ type: 'text', content: '' }]);
        return;
      }

      // Handle backspace to delete mention chips
      if (event.key === 'Backspace') {
        const selection = window.getSelection();
        if (selection && selection.rangeCount) {
          const range = selection.getRangeAt(0);
          if (range.collapsed) {
            const node = range.startContainer;
            const offset = range.startOffset;

            // Case 1: Cursor at start of a text node, previous sibling is a chip
            if (offset === 0 && node.nodeType === Node.TEXT_NODE) {
              const prevSibling = node.previousSibling;
              if (prevSibling && (prevSibling as HTMLElement).classList?.contains('mention-chip')) {
                event.preventDefault();
                (prevSibling as HTMLElement).remove();
                setSegments(parseEditorContent());
                return;
              }
            }

            // Case 2: Cursor is inside the editor div itself (not in a text node)
            // This happens when there's only a chip and cursor is after it
            if (node === editorRef.current && offset > 0) {
              const childBefore = editorRef.current.childNodes[offset - 1];
              if (childBefore && (childBefore as HTMLElement).classList?.contains('mention-chip')) {
                event.preventDefault();
                (childBefore as HTMLElement).remove();
                setSegments(parseEditorContent());
                return;
              }
            }

            // Case 3: Cursor at start of editor div, first child is a chip
            if (node === editorRef.current && offset === 0) {
              const firstChild = editorRef.current.firstChild;
              if (firstChild && (firstChild as HTMLElement).classList?.contains('mention-chip')) {
                // Don't delete on backspace at very start - nothing to delete before
              }
            }
          }
        }
      }
    },
    [
      showAutocomplete,
      autocompleteOptions,
      selectedOptionIndex,
      insertMention,
      onToggle,
      parseEditorContent,
      handleSubmit,
      maxSubmits,
      submitTextOverride,
    ]
  );

  return (
    <div className="global-chat-system">
      {/* Recent messages overlay (auto-fading, when chat is closed) */}
      {!isVisible && overlayMessages.length > 0 && (
        <div className="global-chat-recent">
          {overlayMessages.map((message) => (
            <div
              key={message.id}
              className={`global-chat-recent-message ${message.expiring ? 'expiring' : ''}`}
            >
              <span className="global-chat-timestamp">{formatTime(message.timestamp)}</span>
              {message.unitName && (
                <span className="global-chat-unit-name" style={{ color: message.unitColor }}>
                  {message.unitName}:
                </span>
              )}
              <span className="global-chat-text">{message.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Full chat interface (when open) */}
      {isVisible && (
        <div
          ref={chatRef}
          className={`global-chat-interface ${isDragging ? 'dragging' : ''}`}
          data-tutorial-target="global-chat"
          style={
            position
              ? {
                  transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)`,
                }
              : undefined
          }
          onMouseDown={handleDragStart}
        >
          {/* Message History - only show if there are messages */}
          {messages.length > 0 && (
            <div className="global-chat-history">
              <div ref={historyRef} className="global-chat-messages">
                {[...messages].reverse().map((message) => (
                  <div key={message.id} className={`global-chat-message ${message.type}`}>
                    <span className="global-chat-timestamp">{formatTime(message.timestamp)}</span>
                    {message.unitName && (
                      <span className="global-chat-unit-name" style={{ color: message.unitColor }}>
                        {message.unitName}:
                      </span>
                    )}
                    <span className="global-chat-text">{message.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat Input */}
          <div className="global-chat-input-container">
            <div className="global-chat-input-wrapper">
              <span className="global-chat-prompt">Say:</span>
              <div
                ref={editorRef}
                className="global-chat-editor"
                contentEditable
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                data-placeholder="Type your message... (@mention agents)"
                suppressContentEditableWarning
              />
            </div>

            {/* Autocomplete Dropdown */}
            {showAutocomplete && (
              <div className="global-chat-autocomplete">
                {autocompleteOptions.map((option, index) => (
                  <div
                    key={option.id}
                    className={`global-chat-autocomplete-item ${
                      index === selectedOptionIndex ? 'selected' : ''
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(option);
                    }}
                  >
                    <span className="agent-name">@{option.displayName}</span>
                    {option.type === 'hero' && <span className="unit-type-badge hero">Hero</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
