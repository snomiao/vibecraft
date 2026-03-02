import { useMemo } from 'react';
import {
  resolveAbilitiesForSelection,
  type AbilityResolutionInput,
  type AbilityResolution,
} from '../../components/hud/abilityBuilder';

export const useAbilityResolution = (input: AbilityResolutionInput): AbilityResolution => {
  const { selectedEntity, selectedAgents, ctx, activeAgentTerminalId } = input;
  return useMemo(
    () =>
      resolveAbilitiesForSelection({
        selectedEntity,
        selectedAgents,
        ctx,
        activeAgentTerminalId,
      }),
    [activeAgentTerminalId, ctx, selectedAgents, selectedEntity]
  );
};
