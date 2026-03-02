import { useEffect, useState } from 'react';
import type { Agent, BrowserPanel, Folder, Hero, TerminalPanel, WorldEntity } from '../../../shared/types';

interface DetailsPanelProps {
  entity: WorldEntity;
  terminalProcess: string | null;
  onHeroNameCommit?: (name: string) => void;
  onAgentNameCommit?: (agentId: string, name: string) => void;
}

export default function DetailsPanel({
  entity,
  terminalProcess,
  onHeroNameCommit,
  onAgentNameCommit,
}: DetailsPanelProps) {
  const [heroNameDraft, setHeroNameDraft] = useState('');
  const [agentNameDraft, setAgentNameDraft] = useState('');

  useEffect(() => {
    if (entity.type === 'hero') {
      setHeroNameDraft(entity.name);
      return;
    }
    setHeroNameDraft('');
  }, [entity]);

  useEffect(() => {
    if (entity.type === 'agent') {
      setAgentNameDraft(entity.displayName);
      return;
    }
    setAgentNameDraft('');
  }, [entity]);

  const renderHeroDetails = (hero: Hero) => {
    const commitHeroName = () => {
      const trimmed = heroNameDraft.trim();
      if (!trimmed) {
        setHeroNameDraft(hero.name);
        return;
      }
      if (trimmed !== hero.name) {
        onHeroNameCommit?.(trimmed);
      }
    };

    return (
      <>
        <div className="detail-row">
          <span className="detail-label">Name</span>
          <input
            className="detail-input"
            value={heroNameDraft}
            onChange={(event) => setHeroNameDraft(event.target.value)}
            onBlur={commitHeroName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === 'Escape') {
                setHeroNameDraft(hero.name);
                event.currentTarget.blur();
              }
            }}
          />
        </div>
        <div className="detail-row">
          <span className="detail-label">Provider</span>
          <span className="detail-value">{hero.provider}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Model</span>
          <span className="detail-value">{hero.model || 'default'}</span>
        </div>
      </>
    );
  };

  const renderAgentDetails = () => {
    const agent = entity as Agent;
    if (!agent) return null;

    const commitAgentName = () => {
      const trimmed = agentNameDraft.trim();
      if (!trimmed) {
        setAgentNameDraft(agent.displayName);
        return;
      }
      if (trimmed !== agent.displayName) {
        onAgentNameCommit?.(agent.id, trimmed);
      }
    };

    return (
      <>
        <div className="detail-row">
          <span className="detail-label">Name</span>
          <input
            className="detail-input"
            value={agentNameDraft}
            onChange={(event) => setAgentNameDraft(event.target.value)}
            onBlur={commitAgentName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === 'Escape') {
                setAgentNameDraft(agent.displayName);
                event.currentTarget.blur();
              }
            }}
          />
        </div>
        <div className="detail-row">
          <span className="detail-label">Provider</span>
          <span className="detail-value">{agent.provider}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Status</span>
          <span className={`detail-value status-${agent.status}`}>{agent.status}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Attached</span>
          <span className="detail-value">{agent.attachedFolderId ? 'Yes' : 'No'}</span>
        </div>
      </>
    );
  };

  const renderFolderDetails = () => {
    const folder = entity as Folder;
    if (!folder) return null;

    return (
      <>
        <div className="detail-row">
          <span className="detail-label">Name</span>
          <span className="detail-value">{folder.name}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Path</span>
          <span className="detail-value">{folder.relativePath}</span>
        </div>
      </>
    );
  };

  const renderBrowserDetails = () => {
    const panel = entity as BrowserPanel;
    if (!panel) return null;

    return (
      <>
        <div className="detail-row">
          <span className="detail-label">URL</span>
          <span className="detail-value url">{panel.url}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Size</span>
          <span className="detail-value">
            {panel.width} × {panel.height}
          </span>
        </div>
      </>
    );
  };

  const renderTerminalDetails = () => {
    const terminal = entity as TerminalPanel;
    if (!terminal) return null;
    const path = terminal.lastKnownCwd || terminal.originRelativePath || '.';
    const processLabel = terminalProcess && terminalProcess.trim() ? terminalProcess : 'Idle';

    return (
      <>
        <div className="detail-row">
          <span className="detail-label">Path</span>
          <span className="detail-value">{path}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Process</span>
          <span className="detail-value">{processLabel}</span>
        </div>
      </>
    );
  };

  const getTitle = () => {
    switch (entity.type) {
      case 'hero':
        return '⭐ Hero';
      case 'agent':
        return '🤖 Agent';
      case 'folder':
        return '📁 Project';
      case 'browser':
        return '🌐 Browser';
      case 'terminal':
        return '💻 Terminal';
      default:
        return 'Entity';
    }
  };

  return (
    <div className="details-panel">
      <div className="panel-header">{getTitle()}</div>
      <div className="panel-content">
        {entity.type === 'hero' && renderHeroDetails(entity)}
        {entity.type === 'agent' && renderAgentDetails()}
        {entity.type === 'folder' && renderFolderDetails()}
        {entity.type === 'browser' && renderBrowserDetails()}
        {entity.type === 'terminal' && renderTerminalDetails()}
      </div>
    </div>
  );
}
