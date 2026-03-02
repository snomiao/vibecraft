import { useState } from 'react';
import type { Agent } from '../../shared/types';
import { useTheme } from '../theme/themeContext';
import { getContextMeter } from '../utils/contextMeter';
import { getProviderIconUrl } from '../utils/providerIcons';

interface AgentRosterOverlayProps {
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  folderNameById?: Record<string, string | undefined>;
  completedAgentIds?: ReadonlySet<string>;
}

const dimColor = (hex: string, alpha = 0.45): string => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function AgentRosterOverlay({
  agents,
  selectedId,
  onSelect,
  folderNameById = {},
  completedAgentIds = new Set<string>(),
}: AgentRosterOverlayProps) {
  const { activeTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  const workingCount = agents.filter((a) => a.status === 'working').length;
  const idleCount = agents.length - workingCount;

  const getSummaryText = () => {
    const parts: string[] = [];
    if (workingCount > 0) parts.push(`${workingCount} working`);
    if (idleCount > 0) parts.push(`${idleCount} idle`);
    return `Agents: ${parts.join(', ')}`;
  };

  if (agents.length === 0) return null;

  if (collapsed) {
    return (
      <div className="agent-roster-overlay collapsed" role="group" aria-label="Agent roster">
        <button
          type="button"
          className="agent-roster-expand-btn"
          onClick={() => setCollapsed(false)}
          aria-expanded={false}
          title="Expand roster"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path
              d="M2 3L5 7L8 3"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="agent-roster-expand-summary">{getSummaryText()}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="agent-roster-overlay" role="group" aria-label="Agent roster">
      <button
        type="button"
        className="agent-roster-collapse-btn"
        onClick={() => setCollapsed(true)}
        title="Collapse roster"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <path
            d="M2 7L5 3L8 7"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div className="agent-roster-list">
        {agents.map((agent) => {
          const isSelected = selectedId === agent.id;
          const isWorking = agent.status === 'working';
          const hasCompletionBadge = completedAgentIds.has(agent.id);
          const attachedFolderName = agent.attachedFolderId
            ? folderNameById[agent.attachedFolderId]
            : undefined;
          const summaryText = agent.summary?.trim();
          const { percent: contextPercent, variant: contextVariant } = getContextMeter(agent.contextLeft);
          const contextColor =
            contextVariant === 'red'
              ? activeTheme.foundation.palette.status.danger
              : contextVariant === 'yellow'
                ? activeTheme.foundation.palette.status.warning
                : activeTheme.foundation.palette.status.success;

          const statusClass = isWorking ? 'working' : agent.status;
          const isConnected = !!agent.attachedFolderId;
          const displayColor = isConnected ? agent.color : dimColor(agent.color);

          const ariaLabelBase = agent.attachedFolderId
            ? `${agent.displayName} — ${agent.status} — ${attachedFolderName ?? 'attached'}`
            : `${agent.displayName} — ${agent.status}`;
          const ariaLabel = hasCompletionBadge ? `${ariaLabelBase} — completed` : ariaLabelBase;

          return (
            <button
              key={agent.id}
              type="button"
              className={`agent-roster-row${isSelected ? ' selected' : ''} status-${statusClass}`}
              style={{ '--agent-color': displayColor } as React.CSSProperties}
              onClick={() => onSelect(agent.id)}
              title={ariaLabel}
              aria-label={ariaLabel}
            >
              <div className="agent-roster-avatar">
                <img
                  className="agent-roster-icon"
                  src={getProviderIconUrl(agent.provider)}
                  alt={agent.provider}
                />
                <div className="agent-roster-health">
                  <div
                    className="agent-roster-health-fill"
                    style={{ width: `${contextPercent}%`, background: contextColor }}
                  />
                </div>
              </div>

              <div className="agent-roster-info">
                <div className="agent-roster-name-row">
                  <span className="agent-roster-name">{agent.displayName}</span>
                  {isWorking && (
                    <span className="agent-roster-thinking-indicator">
                      <span className="agent-roster-thinking-dot">•</span>
                      <span className="agent-roster-thinking-dot">•</span>
                      <span className="agent-roster-thinking-dot">•</span>
                    </span>
                  )}
                  {attachedFolderName && (
                    <span className="agent-roster-context" title={attachedFolderName}>
                      {attachedFolderName}
                    </span>
                  )}
                </div>
                {summaryText && (
                  <div className="agent-roster-summary" title={summaryText}>
                    {summaryText}
                  </div>
                )}
              </div>
              {hasCompletionBadge && <span className="agent-roster-completion-badge" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
