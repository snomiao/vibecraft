# VibeCraft Paywall Integration

This document describes how the Electron app integrates with the licensing backend to gate access, launch Stripe checkout, and handle multi-device pairing.

## Components

- Main process API client: `vibecraft/src/main/services/licenseClient.ts`
- Main process runtime wrapper: `vibecraft/src/main/services/licenseRuntime.ts`
- IPC handlers: `vibecraft/src/main/ipc.ts`
- Deep link handling: `vibecraft/src/main/index.ts`
- Renderer state + gating logic: `vibecraft/src/renderer/state/licenseStore.ts`, `vibecraft/src/renderer/App.tsx`
- Paywall UI: `vibecraft/src/renderer/components/LicenseGateOverlay.tsx`, `vibecraft/src/renderer/components/LicenseGatePanel.tsx`, `vibecraft/src/renderer/styles/components/license-gate.css`
- Tutorial completion prompt: `vibecraft/src/renderer/components/TutorialCompletionOverlay.tsx`, `vibecraft/src/renderer/styles/components/tutorial-complete.css`

## Environment

- `VIBECRAFT_LICENSE_API_URL`: backend base URL. Defaults to `http://localhost:8787` in dev.
- `VIBECRAFT_PRICING_URL`: pricing page URL. Defaults to `http://localhost:5173/checkout` in dev.
- `VIBECRAFT_LICENSE_PUBLIC_KEY`: Ed25519 public key (PEM) used to verify license tokens.
- `VIBECRAFT_NETWORK_CHECK_URL`: optional URL used for online checks (defaults to a lightweight 204 endpoint).
- `VIBECRAFT_LICENSE_CHECK`: set to `1` in development to enable license checks; otherwise the app bypasses the paywall locally.

## Flow Overview

### 1) App start → device registration

- Renderer calls `initializeLicense()` on load.
- IPC `license-register` calls `/v1/devices/register` and then `/v1/license/status`.
- The renderer stores the license snapshot; if inactive, the paywall opens automatically.

### 2) Access gating

- App renders the paywall overlay whenever license is not ready or not active.
- When a subscription is active, the overlay can be opened manually via the title bar "Subscription" button.
- If the backend is unavailable but the device is online, the app can fall back to a cached, signed license token.
- In development, license checks are disabled by default unless `VIBECRAFT_LICENSE_CHECK=1` is provided.

### 2b) Tutorial completion prompt

- The tutorial completion overlay embeds the paywall panel to encourage conversion after the intro walkthrough.
- Trial users see checkout + pairing options; active subscribers only see the completion message.

### 3) Start checkout

- The user clicks "Start subscription" in the overlay.
- The overlay lets users pick monthly vs yearly billing before starting checkout.
- IPC `license-start-checkout` calls `/v1/checkout/token` and opens the pricing URL in the system browser with `?token=<token>&plan=monthly|annual`.
- The app polls license status after checkout so activation can complete even if the deep link is missed.
- Users can manually refresh status or paste a Stripe session ID to recover from a failed redirect.

### 4) Checkout completion (deep link)

- Stripe redirects to `vibecraft://checkout/success?session_id=...`.
- Main process listens for the protocol event and calls `/v1/checkout/confirm`.
- After confirm, the app refreshes status and notifies the renderer via `license-updated`.

### 5) Pairing additional devices

- Active devices can generate a pairing code (`/v1/pairing/start`).
- Inactive devices can claim a code (`/v1/pairing/claim`).
- The overlay supports both workflows depending on access state.

## IPC Surface

- `license-register`: register device and pull status
- `license-status`: refresh status
- `license-start-checkout`: open pricing page
- `license-pairing-start`: generate pairing code
- `license-pairing-claim`: claim pairing code
- Renderer events: `license-updated`, `license-error`

## Error Handling

- Network/config errors are surfaced in the overlay.
- Stripe/session/limit errors map to user-friendly copy in the overlay.
- If the backend is down and a cached license token exists, access is allowed even if the token is expired.

## Local Testing Notes

- Ensure the backend and pricing page URLs are configured via env.
- Use Stripe test mode when validating checkout flows.
