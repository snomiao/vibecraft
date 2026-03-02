import { useEffect } from 'react';
import type { AbilityDescriptor } from '../../../components/hud/abilityBuilder';
import type { CommandInvocation } from '../../../commands/registry';
import {
  getVariantSelections,
  resolveAbilityIndexFromKey,
  resolveEffectiveCommandId,
  type HotkeyMode,
} from '../../../components/hud/hotkeys';
import { isDeleteAbility } from '../../../components/hud/abilityUtils';
import { isInputCaptured } from '../inputCapture';
import type { HotkeyRouterReturn } from './useHotkeyRouter';

const ABILITY_HOTKEY_PRIORITY = 10;

type UseAbilityHotkeysParams = {
  registerHotkeyHandler: HotkeyRouterReturn['registerHotkeyHandler'];
  abilities: AbilityDescriptor[];
  hotkeyMode: HotkeyMode;
  onAbility: (ability: CommandInvocation) => void;
  onAbilityPress?: (index: number) => void;
};

export function useAbilityHotkeys({
  registerHotkeyHandler,
  abilities,
  hotkeyMode,
  onAbility,
  onAbilityPress,
}: UseAbilityHotkeysParams) {
  useEffect(() => {
    return registerHotkeyHandler({
      priority: ABILITY_HOTKEY_PRIORITY,
      handler: (event) => {
        if (isInputCaptured()) return false;
        if (event.altKey || event.ctrlKey || event.metaKey) return false;
        const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace';
        if (isDeleteKey) {
          const deleteIndex = abilities.findIndex((ability) => isDeleteAbility(ability));
          if (deleteIndex !== -1) {
            const ability = abilities[deleteIndex];
            if (!ability || ability.disabled) return false;
            event.preventDefault();
            onAbilityPress?.(deleteIndex);
            const variantSelections = getVariantSelections();
            const commandId = resolveEffectiveCommandId(ability, variantSelections);
            onAbility(commandId);
            return true;
          }
        }
        const abilityIndex = resolveAbilityIndexFromKey(event.key, hotkeyMode, abilities);
        if (abilityIndex === null) return false;
        const ability = abilities[abilityIndex];
        if (!ability || ability.disabled) return false;
        event.preventDefault();

        onAbilityPress?.(abilityIndex);
        const variantSelections = getVariantSelections();
        const command = resolveEffectiveCommandId(ability, variantSelections);
        onAbility(command);
        return true;
      },
    });
  }, [abilities, hotkeyMode, onAbility, onAbilityPress, registerHotkeyHandler]);
}

export default useAbilityHotkeys;
