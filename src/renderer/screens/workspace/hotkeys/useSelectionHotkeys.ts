import { useEffect } from 'react';
import type { SelectedEntityRef } from '../../../../shared/types';
import { isInputCaptured } from '../inputCapture';
import type { HotkeyRouterReturn } from './useHotkeyRouter';

const SELECTION_HOTKEY_PRIORITY = 50;

type UseSelectionHotkeysParams = {
  registerHotkeyHandler: HotkeyRouterReturn['registerHotkeyHandler'];
  rosterAgentIds: string[];
  selectedAgentIds: string[];
  selectedAgentIdSet: Set<string>;
  selectedEntityRef: SelectedEntityRef | null;
  setSelectedEntityRef: React.Dispatch<React.SetStateAction<SelectedEntityRef | null>>;
  setSelectedAgentIds: React.Dispatch<React.SetStateAction<string[]>>;
  activeAgentTerminalId: string | null;
  setActiveAgentTerminalId: React.Dispatch<React.SetStateAction<string | null>>;
  lastTabAgentRef: React.MutableRefObject<string | null>;
};

export function useSelectionHotkeys({
  registerHotkeyHandler,
  rosterAgentIds,
  selectedAgentIds,
  selectedAgentIdSet,
  selectedEntityRef,
  setSelectedEntityRef,
  setSelectedAgentIds,
  activeAgentTerminalId,
  setActiveAgentTerminalId,
  lastTabAgentRef,
}: UseSelectionHotkeysParams) {
  useEffect(() => {
    return registerHotkeyHandler({
      priority: SELECTION_HOTKEY_PRIORITY,
      handler: (event) => {
        if (event.key !== 'Tab') return false;
        if (isInputCaptured()) return false;
        if (event.altKey || event.ctrlKey || event.metaKey) return false;

        const listSource = rosterAgentIds;
        if (!listSource.length) return false;

        const selectionPool =
          selectedAgentIds.length > 0 ? listSource.filter((id) => selectedAgentIdSet.has(id)) : listSource;
        if (!selectionPool.length) return false;

        const currentCandidate =
          (lastTabAgentRef.current && selectionPool.includes(lastTabAgentRef.current)
            ? lastTabAgentRef.current
            : selectedEntityRef?.type === 'agent' && selectionPool.includes(selectedEntityRef.id)
              ? selectedEntityRef.id
              : null) ?? selectionPool[0];

        const currentIndex = selectionPool.indexOf(currentCandidate);
        const direction = event.shiftKey ? -1 : 1;
        const nextIndex = (currentIndex + direction + selectionPool.length) % selectionPool.length;
        const nextId = selectionPool[nextIndex];
        lastTabAgentRef.current = nextId;

        setSelectedEntityRef({ id: nextId, type: 'agent' });
        if (selectedAgentIds.length === 0) {
          setSelectedAgentIds([]);
        }
        if (activeAgentTerminalId) {
          setActiveAgentTerminalId(nextId);
        }

        event.preventDefault();
        return true;
      },
    });
  }, [
    activeAgentTerminalId,
    lastTabAgentRef,
    registerHotkeyHandler,
    rosterAgentIds,
    selectedAgentIds,
    selectedAgentIdSet,
    selectedEntityRef,
    setActiveAgentTerminalId,
    setSelectedAgentIds,
    setSelectedEntityRef,
  ]);
}

export default useSelectionHotkeys;
