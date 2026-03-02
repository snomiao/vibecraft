import { useCallback, useMemo, useState } from 'react';
import type { Agent, Folder, WorldEntity } from '../../../shared/types';
import type { CommandInvocation, CommandRunResult } from '../../commands/registry';
import type { MentionedUnit } from '../../components/GlobalChat';

interface UseGlobalChatOptions {
  agents: Agent[];
  folders: Folder[];
  heroName: string;
  heroId: string;
  selectedEntity: WorldEntity | null;
  selectedAgentIds: string[];
  runCommand: (command: CommandInvocation) => Promise<CommandRunResult>;
  prefillText?: string;
}

export type GlobalChatProps = {
  isVisible: boolean;
  onToggle: (visible: boolean) => void;
  agents: Agent[];
  heroName: string;
  heroId: string;
  prefillMentions: MentionedUnit[];
  prefillText?: string;
  submitTextOverride?: string;
  displayTextOverride?: string;
  maxSubmits?: number;
  submitGateKey?: string;
  closeOnSubmit?: boolean;
  onSubmitMessage: (
    text: string,
    mentionedUnits: MentionedUnit[],
    runIds: Map<string, string>
  ) => Promise<void>;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function useGlobalChat({
  agents,
  folders,
  heroName,
  heroId,
  selectedEntity,
  selectedAgentIds,
  runCommand,
  prefillText,
}: UseGlobalChatOptions) {
  const [globalChatVisible, setGlobalChatVisible] = useState(false);
  const [prefillMentions, setPrefillMentions] = useState<MentionedUnit[]>([]);

  const buildPrefillMentions = useCallback(() => {
    const mentions: MentionedUnit[] = [];

    if (selectedEntity?.type === 'hero' && selectedAgentIds.length === 0) {
      mentions.push({
        id: heroId,
        type: 'hero',
        displayName: heroName,
        isAttached: true,
      });
    }

    const agentsToMention =
      selectedAgentIds.length > 0
        ? agents.filter((agent) => selectedAgentIds.includes(agent.id))
        : selectedEntity?.type === 'agent'
          ? agents.filter((agent) => agent.id === selectedEntity.id)
          : [];

    for (const agent of agentsToMention) {
      mentions.push({
        id: agent.id,
        type: 'agent',
        displayName: agent.displayName,
        isAttached: !!agent.attachedFolderId,
      });
    }

    return mentions;
  }, [agents, heroId, heroName, selectedAgentIds, selectedEntity]);

  const handleToggle = useCallback((visible: boolean) => {
    setGlobalChatVisible(visible);
    if (!visible) {
      setPrefillMentions([]);
    }
  }, []);

  const openFromHotkey = useCallback(() => {
    if (globalChatVisible) return;
    const mentions = buildPrefillMentions();
    setPrefillMentions(mentions);
    setGlobalChatVisible(true);
  }, [buildPrefillMentions, globalChatVisible]);

  const closeFromHotkey = useCallback(() => {
    handleToggle(false);
  }, [handleToggle]);

  const stripMentionsFromText = useCallback((text: string, mentions: MentionedUnit[]) => {
    let result = text;
    for (const unit of mentions) {
      const escaped = escapeRegExp(unit.displayName);
      result = result.replace(new RegExp(`@${escaped}\\s*`, 'g'), '');
    }
    return result.trim();
  }, []);

  const handleSubmitMessage = useCallback(
    async (text: string, mentionedUnits: MentionedUnit[], runIds: Map<string, string>) => {
      const textForUnit = stripMentionsFromText(text, mentionedUnits);

      const sendPromises = mentionedUnits.map(async (unit) => {
        const runId = runIds.get(unit.id);
        if (!runId) return;

        if (unit.type === 'hero') {
          const relativePath = '.';

          try {
            await runCommand({
              id: 'hero-send-prompt',
              source: 'ui',
              args: {
                prompt: textForUnit,
                relativePath,
                runId,
              },
            });
          } catch (err) {
            console.error('Failed to send message to hero:', err);
          }
          return;
        }

        const agent = agents.find((entry) => entry.id === unit.id);
        if (!agent || !agent.attachedFolderId) return;

        const folder = folders.find((entry) => entry.id === agent.attachedFolderId);
        if (!folder) return;

        try {
          await runCommand({
            id: 'agent-send-prompt',
            source: 'ui',
            args: {
              agentId: unit.id,
              prompt: textForUnit,
              relativePath: folder.relativePath,
              runId,
            },
          });
        } catch (err) {
          console.error(`Failed to send message to agent ${agent.displayName}:`, err);
        }
      });

      await Promise.allSettled(sendPromises);
    },
    [agents, folders, runCommand, stripMentionsFromText]
  );

  const globalChatProps = useMemo<GlobalChatProps>(
    () => ({
      isVisible: globalChatVisible,
      onToggle: handleToggle,
      agents,
      heroName,
      heroId,
      prefillMentions,
      prefillText,
      onSubmitMessage: handleSubmitMessage,
    }),
    [
      agents,
      globalChatVisible,
      handleSubmitMessage,
      handleToggle,
      heroId,
      heroName,
      prefillMentions,
      prefillText,
    ]
  );

  return {
    globalChatProps,
    openFromHotkey,
    closeFromHotkey,
    isGlobalChatVisible: globalChatVisible,
  };
}
