import { useEffect } from 'react';
import type { Agent, Folder, SelectedEntityRef, TutorialState } from '../../shared/types';
import type { MentionedUnit } from '../components/GlobalChat';
import type { GlobalChatProps } from '../screens/workspace/useGlobalChat';
import { workspaceClient } from '../services/workspaceClient';
import type { TutorialPromptStep } from './policy';

type TutorialChatPropsOptions = {
  tutorialEnabled: boolean;
  tutorialPromptStep: TutorialPromptStep;
  tutorialAgentId?: string;
  tutorialAgentId2?: string;
  tutorialFolderId?: string;
  tutorialFolderId2?: string;
  agents: Agent[];
  folders: Folder[];
  selectedEntityRef: SelectedEntityRef | null;
  globalChatProps: GlobalChatProps;
  workspacePath: string;
  ensureTutorialServer: (scenario: 'cookie-clicker' | 'doodle-jump') => Promise<boolean>;
  setTutorialPromptRunId: (runId: string) => void;
  setTutorialPromptRunId2: (runId: string) => void;
  updateTutorial: (updates: Partial<TutorialState>) => void;
};

type TutorialChatEffectsOptions = {
  tutorialEnabled: boolean;
  tutorialState: TutorialState;
  tutorialAgentId?: string;
  tutorialAgentId2?: string;
  selectedEntityRef: SelectedEntityRef | null;
  setSelectedEntityRef: (next: SelectedEntityRef | null) => void;
  isGlobalChatVisible: boolean;
  updateTutorial: (updates: Partial<TutorialState>) => void;
  activeAgentTerminalId: string | null;
  closeAgentTerminals: (ids: string[]) => void;
};

export const buildTutorialChatProps = ({
  tutorialEnabled,
  tutorialPromptStep,
  tutorialAgentId,
  tutorialAgentId2,
  tutorialFolderId,
  tutorialFolderId2,
  agents,
  folders,
  selectedEntityRef,
  globalChatProps,
  workspacePath,
  ensureTutorialServer,
  setTutorialPromptRunId,
  setTutorialPromptRunId2,
  updateTutorial,
}: TutorialChatPropsOptions): GlobalChatProps => {
  if (!tutorialEnabled || !tutorialPromptStep) {
    return globalChatProps;
  }
  const { isSecondPrompt, promptText } = tutorialPromptStep;
  const targetAgentId = isSecondPrompt ? tutorialAgentId2 : tutorialAgentId;
  const targetAgent = targetAgentId ? agents.find((agent) => agent.id === targetAgentId) : undefined;
  const preferredFolderId = isSecondPrompt ? tutorialFolderId2 : tutorialFolderId;
  const fallbackAgent =
    targetAgent ??
    (preferredFolderId ? agents.find((agent) => agent.attachedFolderId === preferredFolderId) : undefined) ??
    (selectedEntityRef?.type === 'agent'
      ? agents.find((agent) => agent.id === selectedEntityRef.id)
      : undefined) ??
    (isSecondPrompt ? agents.find((agent) => agent.id !== tutorialAgentId) : undefined) ??
    agents[agents.length - 1];
  const effectiveAgent = targetAgent ?? fallbackAgent;
  const effectiveAgentId = effectiveAgent?.id;
  const submitGateKey = isSecondPrompt ? 'send-prompt-2' : 'send-prompt';
  const displayTextOverride = effectiveAgent ? `@${effectiveAgent.displayName} ${promptText}` : promptText;
  const prefillMentions = effectiveAgent
    ? [
        {
          id: effectiveAgent.id,
          type: 'agent' as const,
          displayName: effectiveAgent.displayName,
          isAttached: true,
        },
      ]
    : (globalChatProps.prefillMentions ?? []).map((unit) => ({ ...unit, isAttached: true }));
  return {
    ...globalChatProps,
    prefillText: promptText,
    prefillMentions,
    submitTextOverride: promptText,
    displayTextOverride,
    maxSubmits: 1,
    submitGateKey,
    closeOnSubmit: true,
    onSubmitMessage: async (_text: string, mentionedUnits: MentionedUnit[], runIds: Map<string, string>) => {
      const text = promptText;
      const runId =
        (effectiveAgentId ? runIds.get(effectiveAgentId) : undefined) ??
        runIds.values().next().value ??
        (effectiveAgentId
          ? `global-chat-agent-${effectiveAgentId}-${Date.now()}`
          : `global-chat-agent-${Date.now()}`);
      if (isSecondPrompt) {
        setTutorialPromptRunId2(runId);
        void ensureTutorialServer('doodle-jump');
      } else {
        setTutorialPromptRunId(runId);
        void ensureTutorialServer('cookie-clicker');
      }
      if (isSecondPrompt) {
        updateTutorial({ stepId: 'open-browser-1' });
      } else {
        updateTutorial({ stepId: 'open-terminal' });
      }
      const submit = async () => {
        const fallbackFolder =
          (effectiveAgent?.attachedFolderId
            ? folders.find((folder) => folder.id === effectiveAgent.attachedFolderId)
            : undefined) ??
          (preferredFolderId ? folders.find((folder) => folder.id === preferredFolderId) : undefined) ??
          (isSecondPrompt
            ? folders
                .filter((folder) => folder.id !== tutorialFolderId)
                .reduce<
                  Folder | undefined
                >((latest, folder) => (!latest || folder.createdAt > latest.createdAt ? folder : latest), undefined)
            : folders.reduce<Folder | undefined>(
                (latest, folder) => (!latest || folder.createdAt > latest.createdAt ? folder : latest),
                undefined
              ));
        if (effectiveAgentId && fallbackFolder) {
          const result = await workspaceClient.agentConnectRunAgent({
            agentId: effectiveAgentId,
            workspacePath,
            relativePath: fallbackFolder.relativePath,
            prompt: text,
            runId: runId ?? undefined,
            tutorialMode: true,
            tutorialScenario: isSecondPrompt ? 'doodle-jump' : 'cookie-clicker',
          });
          if (result?.success) {
            return;
          }
        }
        if (effectiveAgentId) {
          const filteredUnits = mentionedUnits.filter((unit) => unit.id === effectiveAgentId);
          const filteredRunIds = new Map(
            Array.from(runIds.entries()).filter(([unitId]) => unitId === effectiveAgentId)
          );
          if (filteredRunIds.size === 0 && runId) {
            filteredRunIds.set(effectiveAgentId, runId);
          }
          await globalChatProps.onSubmitMessage(text, filteredUnits, filteredRunIds);
          return;
        }
        if (runId && mentionedUnits.length > 0 && runIds.size === 0) {
          const seededRunIds = new Map(runIds);
          for (const unit of mentionedUnits) {
            seededRunIds.set(unit.id, runId);
          }
          await globalChatProps.onSubmitMessage(text, mentionedUnits, seededRunIds);
          return;
        }
        await globalChatProps.onSubmitMessage(text, mentionedUnits, runIds);
      };
      window.setTimeout(() => {
        void submit();
      }, 0);
    },
  };
};

export const canOpenTutorialGlobalChat = (
  tutorialEnabled: boolean,
  tutorialState: TutorialState,
  tutorialPromptRunId: string | null,
  tutorialPromptRunId2: string | null
): boolean => {
  if (!tutorialEnabled) return true;
  if (
    !['open-global-chat', 'send-prompt', 'open-global-chat-2', 'send-prompt-2'].includes(tutorialState.stepId)
  ) {
    return false;
  }
  if (tutorialState.stepId === 'send-prompt' && tutorialPromptRunId) {
    return false;
  }
  if (tutorialState.stepId === 'send-prompt-2' && tutorialPromptRunId2) {
    return false;
  }
  return true;
};

export const useTutorialChatEffects = ({
  tutorialEnabled,
  tutorialState,
  tutorialAgentId,
  tutorialAgentId2,
  selectedEntityRef,
  setSelectedEntityRef,
  isGlobalChatVisible,
  updateTutorial,
  activeAgentTerminalId,
  closeAgentTerminals,
}: TutorialChatEffectsOptions): void => {
  useEffect(() => {
    if (!tutorialEnabled) return;
    if (tutorialState.stepId === 'open-global-chat') {
      if (tutorialAgentId && selectedEntityRef?.id !== tutorialAgentId) {
        setSelectedEntityRef({ id: tutorialAgentId, type: 'agent' });
      }
      if (isGlobalChatVisible) {
        updateTutorial({ stepId: 'send-prompt' });
      }
      return;
    }
    if (tutorialState.stepId === 'open-global-chat-2') {
      if (tutorialAgentId2 && selectedEntityRef?.id !== tutorialAgentId2) {
        setSelectedEntityRef({ id: tutorialAgentId2, type: 'agent' });
      }
      if (isGlobalChatVisible) {
        updateTutorial({ stepId: 'send-prompt-2' });
      }
    }
  }, [
    isGlobalChatVisible,
    selectedEntityRef?.id,
    tutorialAgentId,
    tutorialAgentId2,
    tutorialEnabled,
    tutorialState.stepId,
    updateTutorial,
    setSelectedEntityRef,
  ]);

  useEffect(() => {
    if (!tutorialEnabled) return;
    if (tutorialState.stepId === 'send-prompt') {
      if (tutorialAgentId && selectedEntityRef?.id !== tutorialAgentId) {
        setSelectedEntityRef({ id: tutorialAgentId, type: 'agent' });
      }
      return;
    }
    if (tutorialState.stepId === 'send-prompt-2') {
      if (tutorialAgentId2 && selectedEntityRef?.id !== tutorialAgentId2) {
        setSelectedEntityRef({ id: tutorialAgentId2, type: 'agent' });
      }
    }
  }, [
    selectedEntityRef?.id,
    tutorialAgentId,
    tutorialAgentId2,
    tutorialEnabled,
    tutorialState.stepId,
    setSelectedEntityRef,
  ]);

  useEffect(() => {
    if (!tutorialEnabled) return;
    if (!['send-prompt', 'send-prompt-2'].includes(tutorialState.stepId)) return;
    if (!activeAgentTerminalId) return;
    closeAgentTerminals([activeAgentTerminalId]);
  }, [activeAgentTerminalId, closeAgentTerminals, tutorialEnabled, tutorialState.stepId]);
};
