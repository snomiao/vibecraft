import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import InputDialog from '../../../src/renderer/components/InputDialog';

test('InputDialog confirms trimmed input', async () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<InputDialog title="Name" onConfirm={onConfirm} onCancel={onCancel} />);

  const input = screen.getByTestId('dialog-input');
  await userEvent.type(input, '  Alpha  ');

  const confirm = screen.getByTestId('dialog-confirm');
  await userEvent.click(confirm);

  expect(onConfirm).toHaveBeenCalledWith('Alpha');
});
