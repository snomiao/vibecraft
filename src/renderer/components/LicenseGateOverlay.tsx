import { useEffect, useId, useRef, useState } from 'react';
import type { LicenseCheckoutPlan, LicenseStatus } from '../../shared/types';
import PlanSelector from './PlanSelector';
import { resolveLicenseErrorMessage } from '../utils/licenseErrors';
import {
  trackPaywallShown,
  trackPaywallPlanSelected,
  trackPaywallCheckoutStarted,
  trackPaywallCheckoutFailed,
  trackPaywallPairingStarted,
  trackPaywallPairingSubmitted,
  trackPaywallPairingSucceeded,
  trackPaywallPairingFailed,
  type PaywallShowReason,
} from '../utils/paywallAnalytics';
import { startPaywallSessionReplay, stopPaywallSessionReplay } from '../utils/posthogScreenRecorder';

interface LicenseGateOverlayProps {
  open: boolean;
  license: LicenseStatus | null;
  loadError?: string;
  tutorialCompleted?: boolean;
  onStartCheckout: (plan: LicenseCheckoutPlan) => Promise<{ success: boolean; error?: string }>;
  onClaimPairing: (code: string) => Promise<{ success: boolean; error?: string }>;
  onRetry: () => void;
}

export default function LicenseGateOverlay({
  open,
  license,
  loadError,
  tutorialCompleted,
  onStartCheckout,
  onClaimPairing,
  onRetry,
}: LicenseGateOverlayProps) {
  const [selectedPlan, setSelectedPlan] = useState<LicenseCheckoutPlan>('annual');
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPairing, setShowPairing] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [pairingPending, setPairingPending] = useState(false);
  const pairingInputId = useId();
  const hasTrackedShowRef = useRef(false);

  // Track paywall shown when overlay opens
  useEffect(() => {
    if (open && !hasTrackedShowRef.current) {
      hasTrackedShowRef.current = true;
      let reason: PaywallShowReason = 'trial_ended';
      if (loadError) {
        reason = 'load_error';
      } else if (license?.reason === 'device_limit') {
        reason = 'device_limit';
      }
      trackPaywallShown({
        reason,
        licenseStatus: license?.subscriptionStatus,
        tutorialCompleted,
      });
    }
    if (!open) {
      hasTrackedShowRef.current = false;
    }
  }, [open, loadError, license, tutorialCompleted]);

  useEffect(() => {
    if (open) {
      startPaywallSessionReplay();
      return () => {
        stopPaywallSessionReplay();
      };
    }
    stopPaywallSessionReplay();
  }, [open]);

  if (!open) return null;

  const handlePlanChange = (plan: LicenseCheckoutPlan) => {
    if (plan !== selectedPlan) {
      trackPaywallPlanSelected({ plan, previousPlan: selectedPlan });
    }
    setSelectedPlan(plan);
  };

  const handleSubscribe = async () => {
    setError(null);
    setCheckoutPending(true);
    trackPaywallCheckoutStarted(selectedPlan);
    const result = await onStartCheckout(selectedPlan);
    if (!result.success) {
      trackPaywallCheckoutFailed({ plan: selectedPlan, error: result.error });
      setError(resolveLicenseErrorMessage(result.error) ?? 'Something went wrong. Please try again.');
    }
    setCheckoutPending(false);
  };

  const handleShowPairing = () => {
    trackPaywallPairingStarted();
    setShowPairing(true);
  };

  const handleClaimPairing = async () => {
    const normalized = pairingCode.trim().toUpperCase();
    if (!normalized) return;
    setError(null);
    setPairingPending(true);
    trackPaywallPairingSubmitted();
    const result = await onClaimPairing(normalized);
    if (!result.success) {
      trackPaywallPairingFailed(result.error);
      setError(resolveLicenseErrorMessage(result.error) ?? 'Something went wrong. Please try again.');
    } else {
      trackPaywallPairingSucceeded();
      setPairingCode('');
    }
    setPairingPending(false);
  };

  const isDeviceLimitReached = license?.reason === 'device_limit';

  return (
    <div className="license-gate-overlay" role="dialog" aria-modal="true">
      <div className="license-gate-card">
        {loadError && (
          <div className="license-gate-error-state">
            <h2>Connection Error</h2>
            <p>{resolveLicenseErrorMessage(loadError) ?? 'Unable to verify your subscription.'}</p>
            <button className="license-gate-btn primary" onClick={onRetry}>
              Retry
            </button>
          </div>
        )}

        {!loadError && (
          <>
            <div className="license-gate-header">
              <h2>{isDeviceLimitReached ? 'Device limit reached' : 'Your trial has ended'}</h2>
              <p>
                {isDeviceLimitReached
                  ? "You've reached the maximum number of devices for your subscription."
                  : 'Subscribe to continue using VibeCraft.'}
              </p>
            </div>

            {error && <div className="license-gate-error">{error}</div>}

            {!showPairing ? (
              <>
                <PlanSelector
                  selectedPlan={selectedPlan}
                  onSelectPlan={handlePlanChange}
                  disabled={checkoutPending}
                />

                <button
                  className="license-gate-btn primary"
                  onClick={handleSubscribe}
                  disabled={checkoutPending}
                >
                  {checkoutPending ? 'Opening checkout...' : 'Subscribe'}
                </button>

                <button className="license-gate-link" type="button" onClick={handleShowPairing}>
                  Already subscribed on another device?
                </button>
              </>
            ) : (
              <>
                <div className="license-gate-pairing">
                  <p>Enter the pairing code from your other device to link this one.</p>
                  <label className="license-gate-label" htmlFor={pairingInputId}>
                    Pairing code
                  </label>
                  <div className="license-gate-input-row">
                    <input
                      id={pairingInputId}
                      className="license-gate-input"
                      placeholder="ABCD-1234"
                      value={pairingCode}
                      onChange={(e) => setPairingCode(e.target.value)}
                    />
                    <button
                      className="license-gate-btn secondary"
                      onClick={handleClaimPairing}
                      disabled={pairingPending || !pairingCode.trim()}
                    >
                      {pairingPending ? 'Linking...' : 'Link device'}
                    </button>
                  </div>
                </div>

                <button className="license-gate-link" type="button" onClick={() => setShowPairing(false)}>
                  ← Back to subscribe
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
