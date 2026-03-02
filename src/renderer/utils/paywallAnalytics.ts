import type { LicenseCheckoutPlan, LicenseSubscriptionStatus } from '../../shared/types';
import { sendEvent } from './analytics';
import { startPaywallSessionReplay, stopPaywallSessionReplay } from './posthogScreenRecorder';

export type PaywallShowReason = 'trial_ended' | 'device_limit' | 'load_error' | 'manual_open';
export type SubscriptionVia = 'checkout' | 'pairing';

export const trackPaywallShown = (options: {
  reason: PaywallShowReason;
  licenseStatus?: LicenseSubscriptionStatus | null;
  tutorialCompleted?: boolean;
}): void => {
  startPaywallSessionReplay();
  sendEvent('paywall_shown', {
    reason: options.reason,
    license_status: options.licenseStatus ?? undefined,
    tutorial_completed: options.tutorialCompleted ?? undefined,
  });
};

export const trackPaywallPlanSelected = (options: {
  plan: LicenseCheckoutPlan;
  previousPlan?: LicenseCheckoutPlan;
}): void => {
  sendEvent('paywall_plan_selected', {
    plan: options.plan,
    previous_plan: options.previousPlan ?? undefined,
  });
};

export const trackPaywallCheckoutStarted = (plan: LicenseCheckoutPlan): void => {
  sendEvent('paywall_checkout_started', {
    plan,
  });
};

export const trackPaywallCheckoutOpened = (plan: LicenseCheckoutPlan): void => {
  sendEvent('paywall_checkout_opened', {
    plan,
  });
};

export const trackPaywallCheckoutCompleted = (options: {
  plan: LicenseCheckoutPlan;
  subscriptionStatus?: LicenseSubscriptionStatus;
}): void => {
  stopPaywallSessionReplay();
  sendEvent('paywall_checkout_completed', {
    plan: options.plan,
    subscription_status: options.subscriptionStatus ?? undefined,
  });
};

export const trackPaywallCheckoutFailed = (options: { plan: LicenseCheckoutPlan; error?: string }): void => {
  sendEvent('paywall_checkout_failed', {
    plan: options.plan,
    error: options.error ?? undefined,
  });
};

export const trackPaywallDismissed = (): void => {
  stopPaywallSessionReplay();
  sendEvent('paywall_dismissed', {});
};

export const trackPaywallPairingStarted = (): void => {
  sendEvent('paywall_pairing_started', {});
};

export const trackPaywallPairingSubmitted = (): void => {
  sendEvent('paywall_pairing_submitted', {});
};

export const trackPaywallPairingSucceeded = (): void => {
  stopPaywallSessionReplay();
  sendEvent('paywall_pairing_succeeded', {});
};

export const trackPaywallPairingFailed = (error?: string): void => {
  sendEvent('paywall_pairing_failed', {
    error: error ?? undefined,
  });
};

export const trackSubscriptionActivated = (options: { plan?: string; via: SubscriptionVia }): void => {
  stopPaywallSessionReplay();
  sendEvent('subscription_activated', {
    plan: options.plan ?? undefined,
    via: options.via,
  });
};

export const trackSubscriptionObserved = (options: {
  plan?: string;
  subscriptionStatus?: LicenseSubscriptionStatus;
}): void => {
  sendEvent('subscription_observed', {
    plan: options.plan ?? undefined,
    subscription_status: options.subscriptionStatus ?? undefined,
  });
};

export const trackSubscriptionCancelled = (options: { plan?: string; periodEnd?: string }): void => {
  sendEvent('subscription_cancelled', {
    plan: options.plan ?? undefined,
    period_end: options.periodEnd ?? undefined,
  });
};
