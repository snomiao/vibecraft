import { useState } from 'react';
import type { LicenseCheckoutPlan } from '../../shared/types';
import PlanSelector from './PlanSelector';
import { resolveLicenseErrorMessage } from '../utils/licenseErrors';

interface SubscribeOverlayProps {
  visible: boolean;
  onDismiss: () => void;
  onStartCheckout: (plan: LicenseCheckoutPlan) => Promise<{ success: boolean; error?: string }>;
}

export default function SubscribeOverlay({ visible, onDismiss, onStartCheckout }: SubscribeOverlayProps) {
  const [selectedPlan, setSelectedPlan] = useState<LicenseCheckoutPlan>('annual');
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  const handleSubscribe = async () => {
    setError(null);
    setCheckoutPending(true);
    const result = await onStartCheckout(selectedPlan);
    if (!result.success) {
      setError(resolveLicenseErrorMessage(result.error) ?? 'Something went wrong. Please try again.');
    }
    setCheckoutPending(false);
  };

  return (
    <div className="subscribe-overlay" role="dialog" aria-modal="true">
      <div className="subscribe-card">
        <button
          className="subscribe-close"
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          disabled={checkoutPending}
        >
          ×
        </button>

        <div className="subscribe-header">
          <h2>Subscribe to VibeCraft</h2>
          <p>Unlock unlimited access to AI coding agents.</p>
        </div>

        <PlanSelector selectedPlan={selectedPlan} onSelectPlan={setSelectedPlan} disabled={checkoutPending} />

        {error && <div className="subscribe-error">{error}</div>}

        <button
          className="subscribe-button"
          type="button"
          onClick={handleSubscribe}
          disabled={checkoutPending}
        >
          {checkoutPending ? 'Opening checkout...' : 'Subscribe'}
        </button>
      </div>
    </div>
  );
}
