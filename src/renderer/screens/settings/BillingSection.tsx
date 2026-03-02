import { useEffect, useId, useState } from 'react';
import type { LicenseCheckoutPlan, LicenseStatus } from '../../../shared/types';
import PlanSelector from '../../components/PlanSelector';
import { resolveLicenseErrorMessage } from '../../utils/licenseErrors';

export interface BillingSectionProps {
  license: LicenseStatus | null;
  onStartCheckout: (plan: LicenseCheckoutPlan) => Promise<{ success: boolean; error?: string }>;
  onManageBilling: () => Promise<{ success: boolean; error?: string; url?: string }>;
  onStartPairing: () => Promise<{ success: boolean; code?: string; expiresAt?: string; error?: string }>;
  onClaimPairing: (code: string) => Promise<{ success: boolean; error?: string }>;
  onRefreshLicense: () => Promise<void>;
}

const formatDate = (value?: string) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatTimeRemaining = (trialEndsAt?: string): string => {
  if (!trialEndsAt) return 'Unknown';
  const end = new Date(trialEndsAt).getTime();
  const now = Date.now();
  const diff = Math.max(0, end - now);

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const formatCodeExpiry = (expiresAt: string): string => {
  const end = new Date(expiresAt).getTime();
  const now = Date.now();
  const diff = Math.max(0, end - now);

  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remainingMins = minutes % 60;
    if (remainingMins > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMins} min`;
    }
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''}`;
};

export default function BillingSection({
  license,
  onStartCheckout,
  onManageBilling,
  onStartPairing,
  onClaimPairing,
  onRefreshLicense,
}: BillingSectionProps) {
  const [selectedPlan, setSelectedPlan] = useState<LicenseCheckoutPlan>('annual');
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [manageBillingPending, setManageBillingPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pairingExpanded, setPairingExpanded] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [pairingClaimPending, setPairingClaimPending] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [pairingGeneratePending, setPairingGeneratePending] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const pairingInputId = useId();

  const isSubscribed = license?.reason === 'subscription';
  const isTrial = license?.reason === 'trial';
  const deviceCount = license?.deviceCount;
  const deviceLimit = license?.deviceLimit;
  const showDeviceCount = isSubscribed && typeof deviceCount === 'number' && typeof deviceLimit === 'number';
  const isCanceling = Boolean(isSubscribed && license?.cancelAtPeriodEnd && license?.currentPeriodEnd);
  const isCanceled = !isSubscribed && license?.subscriptionStatus === 'canceled';
  const planLabel =
    license?.plan === 'annual' ? 'Yearly' : license?.plan === 'monthly' ? 'Monthly' : 'Unknown';
  const statusLabel = isCanceling
    ? 'Canceling'
    : isSubscribed
      ? 'Active'
      : isTrial
        ? 'Trial'
        : isCanceled
          ? 'Canceled'
          : 'Inactive';
  const statusClass = isCanceling
    ? 'canceling'
    : isSubscribed
      ? 'active'
      : isTrial
        ? 'trial'
        : isCanceled
          ? 'canceled'
          : 'inactive';
  const iconClass = isCanceling || isTrial || isCanceled ? 'warning' : isSubscribed ? 'success' : '';
  const canceledMessage = isCanceled
    ? `Subscription canceled${license?.currentPeriodEnd ? ` on ${formatDate(license.currentPeriodEnd)}` : ''}.`
    : 'Subscribe to unlock VibeCraft';

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!active) return;
      void onRefreshLicense();
    };
    refresh();
    const interval = window.setInterval(refresh, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [onRefreshLicense]);

  const handleSubscribe = async () => {
    setError(null);
    setCheckoutPending(true);
    const result = await onStartCheckout(selectedPlan);
    if (!result.success) {
      setError(resolveLicenseErrorMessage(result.error) ?? 'Something went wrong. Please try again.');
    }
    setCheckoutPending(false);
  };

  const handleManageBilling = async () => {
    setError(null);
    setManageBillingPending(true);
    const result = await onManageBilling();
    if (!result.success) {
      setError(resolveLicenseErrorMessage(result.error) ?? 'Something went wrong. Please try again.');
    }
    setManageBillingPending(false);
  };

  const handleClaimPairing = async () => {
    const normalized = pairingCode.trim().toUpperCase();
    if (!normalized) return;
    setError(null);
    setPairingClaimPending(true);
    const result = await onClaimPairing(normalized);
    if (!result.success) {
      setError(resolveLicenseErrorMessage(result.error) ?? 'Something went wrong. Please try again.');
    } else {
      setPairingCode('');
    }
    setPairingClaimPending(false);
  };

  const handleGeneratePairing = async () => {
    setError(null);
    setPairingGeneratePending(true);
    const result = await onStartPairing();
    if (!result.success || !result.code || !result.expiresAt) {
      setError(resolveLicenseErrorMessage(result.error) ?? 'Could not generate pairing code.');
    } else {
      setGeneratedCode({ code: result.code, expiresAt: result.expiresAt });
    }
    setPairingGeneratePending(false);
  };

  const handleCopyCode = async () => {
    if (generatedCode) {
      try {
        await navigator.clipboard.writeText(generatedCode.code);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
      } catch {
        setError('Unable to copy the code. Please copy it manually.');
      }
    }
  };

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Subscription & Billing</h2>
        <p className="settings-section-subtitle">Manage your VibeCraft subscription</p>
      </div>

      <div className="settings-section-content">
        {/* Subscription Status */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className={`settings-card-icon ${iconClass}`}>
              {isSubscribed && !isCanceling ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
            </div>
            <div className="settings-card-title">
              <h3>Subscription</h3>
              <span className={`settings-badge ${statusClass}`}>{statusLabel}</span>
            </div>
          </div>

          <div className="settings-card-body">
            {isSubscribed && (
              <div className="settings-subscription-info">
                <div className="settings-info-row">
                  <span className="settings-info-label">Plan</span>
                  <span className="settings-info-value">{planLabel}</span>
                </div>
                {isCanceling && (
                  <div className="settings-info-row">
                    <span className="settings-info-label">Cancels on</span>
                    <span className="settings-info-value">
                      {formatDate(license?.currentPeriodEnd ?? undefined)}
                    </span>
                  </div>
                )}
                {showDeviceCount && (
                  <div className="settings-info-row">
                    <span className="settings-info-label">Devices</span>
                    <span className="settings-info-value">
                      {deviceCount} of {deviceLimit} used
                    </span>
                  </div>
                )}
                <button
                  className="settings-link-btn"
                  onClick={handleManageBilling}
                  disabled={manageBillingPending}
                >
                  {manageBillingPending ? 'Opening billing...' : 'Manage billing'}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </button>
              </div>
            )}

            {isTrial && (
              <div className="settings-trial-info">
                <div className="settings-trial-time">
                  <span className="settings-trial-remaining">
                    {formatTimeRemaining(license?.trialEndsAt)}
                  </span>
                  <span className="settings-trial-label">remaining</span>
                </div>
                <span className="settings-trial-ends">Ends {formatDate(license?.trialEndsAt)}</span>
              </div>
            )}

            {!isSubscribed && !isTrial && <p className="settings-inactive-text">{canceledMessage}</p>}
          </div>
        </div>

        {error && <div className="settings-error">{error}</div>}

        {/* Subscribe Section */}
        {!isSubscribed && (
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-icon accent">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
              </div>
              <div className="settings-card-title">
                <h3>Subscribe</h3>
              </div>
            </div>

            <div className="settings-card-body">
              <PlanSelector
                selectedPlan={selectedPlan}
                onSelectPlan={setSelectedPlan}
                disabled={checkoutPending}
              />
              <button className="settings-primary-btn" onClick={handleSubscribe} disabled={checkoutPending}>
                {checkoutPending ? 'Opening checkout...' : 'Subscribe'}
              </button>
            </div>
          </div>
        )}

        {/* Device Pairing */}
        <div className="settings-card muted">
          <button
            className="settings-expandable-header"
            onClick={() => setPairingExpanded(!pairingExpanded)}
            aria-expanded={pairingExpanded}
          >
            <div className="settings-expandable-title">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
              <span>{isSubscribed ? 'Use on another device' : 'Already have a subscription?'}</span>
            </div>
            <svg
              className={`settings-expandable-chevron ${pairingExpanded ? 'expanded' : ''}`}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {pairingExpanded && (
            <div className="settings-expandable-content">
              {isSubscribed ? (
                <>
                  {showDeviceCount && (
                    <div className="settings-device-info">
                      <span className="settings-device-count">
                        {deviceCount} of {deviceLimit} devices used
                      </span>
                    </div>
                  )}
                  <p>Generate a code to activate VibeCraft on another device.</p>
                  {generatedCode ? (
                    <div className="settings-pairing-result">
                      <div className="settings-pairing-code">{generatedCode.code}</div>
                      <button className="settings-copy-btn" onClick={handleCopyCode}>
                        {codeCopied ? 'Copied!' : 'Copy'}
                      </button>
                      <span className="settings-pairing-expiry">
                        Expires in {formatCodeExpiry(generatedCode.expiresAt)}
                      </span>
                    </div>
                  ) : (
                    <button
                      className="settings-secondary-btn"
                      onClick={handleGeneratePairing}
                      disabled={pairingGeneratePending}
                    >
                      {pairingGeneratePending ? 'Generating...' : 'Generate code'}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p>Enter a pairing code from your other device.</p>
                  <div className="settings-pairing-input">
                    <input
                      id={pairingInputId}
                      type="text"
                      placeholder="Enter code"
                      value={pairingCode}
                      onChange={(e) => setPairingCode(e.target.value)}
                    />
                    <button
                      className="settings-secondary-btn"
                      onClick={handleClaimPairing}
                      disabled={pairingClaimPending || !pairingCode.trim()}
                    >
                      {pairingClaimPending ? 'Linking...' : 'Link'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
