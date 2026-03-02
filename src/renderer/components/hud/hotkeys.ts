import type { AbilityDescriptor } from './abilityBuilder';
import type { CommandInvocation } from '../../commands/registry';
import { getAbilityVariantSelections, setAbilityVariantSelection } from '../../state/appSettingsStore';
import { isDeleteAbility } from './abilityUtils';

export type HotkeyMode = 'numbers' | 'qwerty';

export const QWERTY_KEYS = ['q', 'w', 'e', 'r', 'd', 'f'];

export const getDeleteHotkeyLabel = (): string => 'DEL';

export function getVariantSelections(): Record<string, string> {
  return getAbilityVariantSelections() as Record<string, string>;
}

export function setVariantSelection(abilityId: string, variantId: string): void {
  setAbilityVariantSelection(abilityId, variantId);
}

export function resolveEffectiveCommandId(
  ability: AbilityDescriptor,
  variantSelections: Record<string, string>
): CommandInvocation {
  if (!ability.variants || ability.variants.length === 0) {
    return ability.action;
  }
  const selectedId = variantSelections[ability.id];
  const variant = ability.variants.find((v) => v.id === selectedId) ?? ability.variants[0];
  return variant.action;
}

export const getHotkeyLabel = (index: number, mode: HotkeyMode): string => {
  if (mode === 'qwerty') {
    return QWERTY_KEYS[index]?.toUpperCase() ?? '';
  }
  if (index >= 9) return '';
  return String(index + 1);
};

export const resolveAbilityIndexFromKey = (
  key: string,
  mode: HotkeyMode,
  abilities: AbilityDescriptor[]
): number | null => {
  const filteredAbilities = abilities.filter((ability) => !isDeleteAbility(ability));
  if (filteredAbilities.length === 0) return null;
  const resolveOriginalIndex = (filteredIndex: number): number | null => {
    if (filteredIndex < 0 || filteredIndex >= filteredAbilities.length) return null;
    let current = -1;
    for (let index = 0; index < abilities.length; index += 1) {
      if (isDeleteAbility(abilities[index])) continue;
      current += 1;
      if (current === filteredIndex) return index;
    }
    return null;
  };

  if (mode === 'qwerty') {
    const keyIndex = QWERTY_KEYS.indexOf(key.toLowerCase());
    if (keyIndex === -1) return null;
    return resolveOriginalIndex(keyIndex);
  }

  const num = Number.parseInt(key, 10);
  if (!Number.isFinite(num) || num < 1 || num > 9) return null;
  return resolveOriginalIndex(num - 1);
};

export const getAbilityHotkeyLabel = (
  ability: AbilityDescriptor,
  index: number,
  mode: HotkeyMode,
  abilities: AbilityDescriptor[]
): string => {
  if (isDeleteAbility(ability)) return getDeleteHotkeyLabel();
  let filteredIndex = -1;
  for (let i = 0; i <= index; i += 1) {
    if (isDeleteAbility(abilities[i])) continue;
    filteredIndex += 1;
  }
  if (filteredIndex < 0) return '';
  return getHotkeyLabel(filteredIndex, mode);
};
