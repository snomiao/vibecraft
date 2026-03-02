import type { LicenseCheckoutPlan } from '../../shared/types';

interface PlanSelectorProps {
  selectedPlan: LicenseCheckoutPlan;
  onSelectPlan: (plan: LicenseCheckoutPlan) => void;
  disabled?: boolean;
}

export default function PlanSelector({ selectedPlan, onSelectPlan, disabled }: PlanSelectorProps) {
  return (
    <div className="plan-selector">
      <button
        type="button"
        className={`plan-card ${selectedPlan === 'monthly' ? 'selected' : ''}`}
        onClick={() => onSelectPlan('monthly')}
        disabled={disabled}
        aria-pressed={selectedPlan === 'monthly'}
      >
        <span className="plan-card-name">Monthly</span>
        <span className="plan-card-price">$20</span>
        <span className="plan-card-period">per month</span>
      </button>
      <button
        type="button"
        className={`plan-card ${selectedPlan === 'annual' ? 'selected' : ''}`}
        onClick={() => onSelectPlan('annual')}
        disabled={disabled}
        aria-pressed={selectedPlan === 'annual'}
      >
        <span className="plan-card-badge">Save 16%</span>
        <span className="plan-card-name">Yearly</span>
        <span className="plan-card-price">$16.67</span>
        <span className="plan-card-period">per month</span>
        <span className="plan-card-billed">billed as $200/year</span>
      </button>
    </div>
  );
}
