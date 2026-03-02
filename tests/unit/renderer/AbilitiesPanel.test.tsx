import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import AbilitiesPanel from '../../../src/renderer/components/hud/AbilitiesPanel';
import type { AbilityDescriptor } from '../../../src/renderer/components/hud/abilityBuilder';

test('AbilitiesPanel dispatches ability clicks', async () => {
  const onAbility = vi.fn();
  const abilities: AbilityDescriptor[] = [
    { id: 'create-folder', label: 'Project', kind: 'primary', action: { id: 'create-folder' } },
  ];

  render(<AbilitiesPanel entityType="agent" abilities={abilities} onAbility={onAbility} />);

  const button = screen.getByTestId('ability-create-folder');
  await userEvent.click(button);

  expect(onAbility).toHaveBeenCalledWith({ id: 'create-folder' });
});
