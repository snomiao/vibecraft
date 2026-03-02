# Subscription Access

Definition

- VibeCraft access is per device, with a free trial and a subscription.
- The access panel lets you start a subscription or link another device.

In‑Game Behavior

- On launch, VibeCraft checks access and shows the panel if needed.
- The panel shows your trial/subscription status and any error messages.
- When access is active, you can reopen the panel from the Subscription button.

Lifecycle

- First launch: your device starts a seven‑day trial.
- Trial active: you can use the app until the trial ends.
- Checkout: choose a plan, complete payment in your browser, and return to the app to finish activation.
- Pairing: if you already subscribed on another device, you can generate a pairing code to link this one.

Interactions / Edge Cases

- If the service is temporarily unavailable, the panel offers a retry option.
- If you recently had access, the app may keep you working briefly during a temporary outage.
- Pairing codes expire after 10 minutes and can be used once.
- Subscriptions that are past due or canceled are treated as inactive.
- The app requires an internet connection to confirm access.

Visuals / UX

- The access panel is modal and blocks gameplay when access is inactive.
- Dates (trial end, pairing expiry) are shown in a human‑readable format.

Invariants

- Access is granted only if the device has an active subscription or an unexpired trial.
- A device is linked to a single subscription at a time.
- Offline access is not supported.
