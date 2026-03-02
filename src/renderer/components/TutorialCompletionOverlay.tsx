import { useState } from 'react';
import type { LicenseCheckoutPlan } from '../../shared/types';
import PlanSelector from './PlanSelector';
import { resolveLicenseErrorMessage } from '../utils/licenseErrors';

interface TutorialCompletionOverlayProps {
  visible: boolean;
  showKicker?: boolean;
  onDismiss: () => void;
  onStartCheckout: (plan: LicenseCheckoutPlan) => Promise<{ success: boolean; error?: string }>;
}

type Step = 'subscribe' | 'trial-started';

export default function TutorialCompletionOverlay({
  visible,
  showKicker = true,
  onDismiss,
  onStartCheckout,
}: TutorialCompletionOverlayProps) {
  const [step, setStep] = useState<Step>('subscribe');
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

  const handleSkip = () => {
    setStep('trial-started');
  };

  const handleStartUsing = () => {
    onDismiss();
  };

  return (
    <div className="tutorial-complete-overlay" role="dialog" aria-modal="true">
      <div className="tutorial-complete-card">
        {step === 'subscribe' && (
          <>
            <div className="tutorial-complete-intro">
              {showKicker && <p className="tutorial-complete-kicker">Tutorial Complete</p>}
              <h2>You&apos;re ready to use VibeCraft!</h2>
              <p>Subscribe to unlock unlimited access and start building with AI coding agents.</p>
            </div>

            <PlanSelector
              selectedPlan={selectedPlan}
              onSelectPlan={setSelectedPlan}
              disabled={checkoutPending}
            />

            {error && <div className="tutorial-complete-error">{error}</div>}

            <button
              className="tutorial-complete-button primary"
              type="button"
              onClick={handleSubscribe}
              disabled={checkoutPending}
            >
              {checkoutPending ? 'Opening checkout...' : 'Subscribe'}
            </button>

            <button
              className="tutorial-complete-skip"
              type="button"
              onClick={handleSkip}
              disabled={checkoutPending}
            >
              Skip for now
            </button>
          </>
        )}

        {step === 'trial-started' && (
          <>
            <div className="tutorial-complete-intro">
              <p className="tutorial-complete-kicker">Trial Started</p>
              <h2>Your 7-day trial has started</h2>
              <p>
                You have full access to VibeCraft for the next 7 days. After that, you&apos;ll need to
                subscribe to continue using it.
              </p>
            </div>

            <button className="tutorial-complete-button primary" type="button" onClick={handleStartUsing}>
              Start using VibeCraft
            </button>
          </>
        )}
      </div>
    </div>
  );
}
