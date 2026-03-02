const errorMessages: Record<string, string> = {
  invalid_device_id: 'We could not verify this device. Please retry.',
  device_not_registered: 'We could not verify this device. Please retry.',
  invalid_checkout_session: 'Payment not verified. Please retry.',
  invalid_checkout_confirm: 'Payment not verified. Please retry.',
  checkout_confirm_failed: 'Payment not verified. Please retry.',
  stripe_error: 'Stripe verification failed. Try again in a moment.',
  checkout_token_unavailable: 'Checkout is temporarily unavailable. Please try again.',
  invalid_checkout_token_request: 'Checkout request is invalid.',
  invalid_checkout_token: 'Checkout link is invalid or expired.',
  pricing_url_missing: 'Checkout URL is not configured.',
  invalid_pricing_url: 'Checkout URL is invalid.',
  device_limit_reached: 'Device limit reached. Use another subscription or contact support.',
  subscription_not_found: 'No active subscription found for this device.',
  stripe_customer_missing: 'Billing details are unavailable for this subscription.',
  billing_portal_unavailable: 'Unable to open billing portal. Please try again.',
  invalid_billing_portal_request: 'Billing request is invalid.',
  invalid_pairing_code: 'Pairing code is invalid or expired.',
  invalid_pairing_claim: 'Pairing code is invalid or expired.',
  invalid_pairing_start: 'Pairing request is invalid.',
  pairing_code_unavailable: 'Pairing codes are temporarily unavailable. Try again soon.',
  license_network_error: 'Unable to reach the licensing service.',
  license_api_not_configured: 'Licensing service is not configured.',
  license_offline: 'Internet connection required to continue.',
  license_token_invalid: 'Unable to verify your license. Please retry.',
  license_token_expired: 'Your license needs to be refreshed. Please reconnect to continue.',
  rate_limit_exceeded: 'Too many requests. Please wait and try again.',
};

export const resolveLicenseErrorMessage = (error?: string): string | null => {
  if (!error) return null;
  return errorMessages[error] ?? 'Something went wrong. Please try again.';
};
