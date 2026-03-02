import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import LicenseGateOverlay from '../../../src/renderer/components/LicenseGateOverlay';
import type { LicenseStatus } from '../../../src/shared/types';

afterEach(() => {
  cleanup();
});

const buildLicense = (overrides: Partial<LicenseStatus> = {}): LicenseStatus => ({
  active: false,
  reason: 'inactive',
  trialEndsAt: '2026-01-01T00:00:00Z',
  subscriptionStatus: 'none',
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  deviceCount: null,
  deviceLimit: null,
  plan: 'unknown',
  ...overrides,
});

describe('LicenseGateOverlay', () => {
  test('renders nothing when closed', () => {
    const { container } = render(
      <LicenseGateOverlay
        open={false}
        license={buildLicense()}
        onStartCheckout={vi.fn()}
        onClaimPairing={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  test('shows error state when loadError is present', () => {
    const onRetry = vi.fn();

    render(
      <LicenseGateOverlay
        open
        license={null}
        loadError="Failed to connect"
        onStartCheckout={vi.fn()}
        onClaimPairing={vi.fn()}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText(/Connection Error/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  test('starts checkout when inactive', async () => {
    const onStartCheckout = vi.fn(async () => ({ success: true }));

    render(
      <LicenseGateOverlay
        open
        license={buildLicense()}
        onStartCheckout={onStartCheckout}
        onClaimPairing={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    // Get the primary subscribe button (not the "Already subscribed" link)
    const subscribeButton = screen.getByRole('button', { name: /^Subscribe$/i });
    fireEvent.click(subscribeButton);
    await waitFor(() => expect(onStartCheckout).toHaveBeenCalledWith('annual'));
  });

  test('shows pairing view and claims code', async () => {
    const onClaimPairing = vi.fn(async () => ({ success: true }));

    render(
      <LicenseGateOverlay
        open
        license={buildLicense()}
        onStartCheckout={vi.fn()}
        onClaimPairing={onClaimPairing}
        onRetry={vi.fn()}
      />
    );

    // Click the link to show pairing section (use exact text match)
    fireEvent.click(screen.getByText('Already subscribed on another device?'));

    fireEvent.change(screen.getByLabelText(/Pairing code/i), { target: { value: 'abcd-1234' } });
    fireEvent.click(screen.getByRole('button', { name: /Link device/i }));

    await waitFor(() => expect(onClaimPairing).toHaveBeenCalledWith('ABCD-1234'));
  });

  test('shows device limit message when reason is device_limit', () => {
    render(
      <LicenseGateOverlay
        open
        license={buildLicense({ reason: 'device_limit' })}
        onStartCheckout={vi.fn()}
        onClaimPairing={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText(/Device limit reached/i)).toBeInTheDocument();
  });
});
