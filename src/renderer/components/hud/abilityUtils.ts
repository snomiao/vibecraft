import type { AbilityDescriptor } from './abilityBuilder';

export const DELETE_ABILITY_IDS = new Set<AbilityDescriptor['id']>([
  'destroy-agent',
  'delete-folder',
  'delete-browser',
  'delete-terminal',
]);

export const isDeleteAbilityId = (id: AbilityDescriptor['id']): boolean => DELETE_ABILITY_IDS.has(id);

export const isDeleteAbility = (ability: AbilityDescriptor): boolean => isDeleteAbilityId(ability.id);
