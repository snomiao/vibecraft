import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import HomeScreen from './screens/HomeScreen';
import CustomTitlebar from './components/CustomTitlebar';
import TrialBanner from './components/TrialBanner';
import type { LicenseCheckoutPlan, Workspace } from '../shared/types';
import { ThemeProvider } from './theme/ThemeProvider';
import { loadAppSettings, updateTutorialState, useAppSettings } from './state/appSettingsStore';
import { DEFAULT_TUTORIAL_STATE, isTutorialActive } from './tutorial/constants';
import {
  applyLicenseUpdate,
  initializeLicense,
  pollLicenseStatus,
  refreshLicenseStatus,
  setLicenseError,
  setPendingActivationVia,
  useLicenseState,
} from './state/licenseStore';
import {
  initRendererAnalytics,
  updateRendererAnalyticsContext,
  shutdownRendererAnalytics,
} from './utils/analytics';

type Screen = 'home' | 'world-selection' | 'workspace' | 'settings';

const LicenseGateOverlay = lazy(() => import('./components/LicenseGateOverlay'));
const WorldSelection = lazy(() => import('./screens/WorldSelection'));
const WorkspaceView = lazy(() => import('./screens/WorkspaceView'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));
const TutorialCompletionOverlay = lazy(() => import('./components/TutorialCompletionOverlay'));
const SubscribeOverlay = lazy(() => import('./components/SubscribeOverlay'));
const SubscriptionSuccessOverlay = lazy(() => import('./components/SubscriptionSuccessOverlay'));

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [subscribeOverlayVisible, setSubscribeOverlayVisible] = useState(false);
  const [tutorialCompleteVisible, setTutorialCompleteVisible] = useState(false);
  const [subscriptionSuccessVisible, setSubscriptionSuccessVisible] = useState(false);
  const [showTutorialCompleteKicker, setShowTutorialCompleteKicker] = useState(true);
  const tutorialCompleteDismissedRef = useRef(false);
  const previousLicenseReasonRef = useRef<string | undefined>(undefined);
  const initialScreenRef = useRef<Screen>(screen);

  const licenseState = useLicenseState();
  const licenseCheckEnabled = window.electronAPI.isLicenseCheckEnabled;
  const appSettings = useAppSettings();
  const tutorialState = appSettings.settings.tutorial ?? DEFAULT_TUTORIAL_STATE;
  const tutorialEnabled = isTutorialActive(tutorialState);

  // Derive license state early so it can be used in effects
  const license = licenseState.license;
  const licenseReady = licenseState.status === 'ready';
  const licenseActive = license?.active ?? false;
  const isSubscription = license?.reason === 'subscription';
  const isTrial = license?.reason === 'trial';

  useEffect(() => {
    void loadAppSettings();
  }, []);

  // Initialize renderer analytics
  useEffect(() => {
    initRendererAnalytics({ screen: initialScreenRef.current });
    return () => {
      shutdownRendererAnalytics('unmount');
    };
  }, []);

  // Update analytics context when screen or workspace changes
  useEffect(() => {
    updateRendererAnalyticsContext({
      screen,
      workspaceId: currentWorkspace?.id ?? null,
      workspaceName: currentWorkspace?.name ?? null,
    });
  }, [screen, currentWorkspace?.id, currentWorkspace?.name]);

  useEffect(() => {
    void initializeLicense();
    const unsubscribe = window.electronAPI.onLicenseUpdated((status) => {
      applyLicenseUpdate(status);
    });
    const unsubscribeError = window.electronAPI.onLicenseError(({ error }) => {
      setLicenseError(error);
    });
    return () => {
      unsubscribe();
      unsubscribeError();
    };
  }, []);

  // Show tutorial completion overlay when tutorial is completed (only once per session).
  // Wait for license to be ready so we only prompt trial users.
  useEffect(() => {
    if (tutorialCompleteVisible) return;
    if (
      tutorialState.status === 'completed' &&
      !tutorialCompleteDismissedRef.current &&
      licenseReady &&
      licenseActive &&
      !isSubscription
    ) {
      const firstSeen = !tutorialState.completionPromptSeenAt;
      setShowTutorialCompleteKicker(firstSeen);
      if (firstSeen) {
        updateTutorialState((current) => ({
          ...current,
          completionPromptSeenAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        }));
      }
      setTutorialCompleteVisible(true);
    }
  }, [
    tutorialCompleteVisible,
    tutorialState.status,
    tutorialState.completionPromptSeenAt,
    licenseReady,
    licenseActive,
    isSubscription,
  ]);

  // Show subscription success celebration when license changes from non-subscription to subscription
  useEffect(() => {
    const previousReason = previousLicenseReasonRef.current;
    previousLicenseReasonRef.current = license?.reason;

    // Only show celebration if:
    // - License is ready
    // - Current reason is 'subscription'
    // - Previous reason was something else (trial, inactive, etc.) or undefined but we had a license loading
    if (licenseReady && isSubscription && previousReason !== undefined && previousReason !== 'subscription') {
      // Dismiss other overlays (subscription success takes priority)
      setTutorialCompleteVisible(false);
      tutorialCompleteDismissedRef.current = true;
      setSubscribeOverlayVisible(false);
      setSubscriptionSuccessVisible(true);
    }
  }, [licenseReady, isSubscription, license?.reason]);

  const handleSelectWorkspace = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    window.electronAPI.addRecentWorkspace(workspace);
    if (tutorialEnabled) {
      updateTutorialState((current) => ({
        ...current,
        status: 'in_progress',
        stepId: 'hero-provider',
        workspaceId: workspace.id,
        workspacePath: workspace.path,
        updatedAt: Date.now(),
        version: 1,
      }));
    }
    setScreen('workspace');
  };

  const handleBack = () => {
    if (tutorialEnabled) return;
    if (screen === 'workspace') {
      setScreen('world-selection');
      setCurrentWorkspace(null);
    } else if (screen === 'world-selection') {
      setScreen('home');
    } else if (screen === 'settings') {
      setScreen('home');
    }
  };

  const handleStartCheckout = async (plan: LicenseCheckoutPlan) => {
    setPendingActivationVia('checkout');
    const result = await window.electronAPI.licenseStartCheckout(plan);
    if (result.success) {
      const { trackPaywallCheckoutOpened } = await import('./utils/paywallAnalytics');
      trackPaywallCheckoutOpened(plan);
      void pollLicenseStatus();
    }
    return result;
  };

  const handleManageBilling = async () => {
    return window.electronAPI.licenseManageBilling();
  };

  const handleRefreshLicense = useCallback(() => {
    return refreshLicenseStatus({ setLoading: false, surfaceErrors: false });
  }, []);

  const handleClaimPairing = async (code: string) => {
    setPendingActivationVia('pairing');
    return window.electronAPI.licensePairingClaim(code);
  };

  const handleOpenSettings = () => {
    setScreen('settings');
  };

  const showBackButton =
    (screen !== 'home' && screen !== 'settings' && !tutorialEnabled) || screen === 'settings';

  // Resume tutorial workspace
  // Wait for license check to complete before auto-navigating
  // (user will see gate if expired, but at least we don't race)
  useEffect(() => {
    if (appSettings.status !== 'loaded') return;
    if (!tutorialEnabled) return;
    if (tutorialState.status !== 'in_progress') return;
    if (tutorialState.stepId === 'world-select') return;
    if (currentWorkspace) return;
    // Wait for license check to complete before resuming
    if (licenseCheckEnabled && !licenseReady) return;
    let active = true;
    void (async () => {
      const recent = await window.electronAPI.getRecentWorkspaces();
      const matched =
        recent.find((workspace) => workspace.id === tutorialState.workspaceId) ??
        recent.find((workspace) => workspace.path === tutorialState.workspacePath);
      const fallback = matched ?? (await window.electronAPI.getTutorialWorld());
      if (!active) return;
      setCurrentWorkspace(fallback);
      setScreen('workspace');
    })();
    return () => {
      active = false;
    };
  }, [
    appSettings.status,
    currentWorkspace,
    tutorialEnabled,
    tutorialState.status,
    tutorialState.stepId,
    tutorialState.workspaceId,
    tutorialState.workspacePath,
    licenseCheckEnabled,
    licenseReady,
  ]);

  // Show license gate in workspace only after we know the device is inactive.
  const showLicenseGate = licenseCheckEnabled && screen === 'workspace' && licenseReady && !licenseActive;
  const licenseGateFallback = (
    <div className="license-gate-overlay" role="presentation" aria-hidden="true">
      <div className="license-gate-loading">
        <p>Checking license status...</p>
      </div>
    </div>
  );

  // Show trial banner when on trial (only after tutorial is completed)
  const tutorialComplete = tutorialState.status === 'completed';
  const showTrialBanner =
    licenseCheckEnabled &&
    licenseReady &&
    licenseActive &&
    isTrial &&
    tutorialComplete &&
    !tutorialCompleteVisible;

  return (
    <ThemeProvider initialTheme="default">
      <div className="app">
        <CustomTitlebar showBackButton={showBackButton} onBack={handleBack} />

        {showTrialBanner && license?.trialEndsAt && (
          <TrialBanner
            trialEndsAt={license.trialEndsAt}
            onSubscribe={() => setSubscribeOverlayVisible(true)}
          />
        )}

        {screen === 'home' && (
          <HomeScreen
            onOpenWorldSelector={() => {
              if (tutorialState.status === 'not_started') {
                updateTutorialState((current) => ({
                  ...current,
                  status: 'in_progress',
                  stepId: 'world-select',
                  updatedAt: Date.now(),
                  version: 1,
                }));
              }
              setScreen('world-selection');
            }}
            onOpenSettings={handleOpenSettings}
            tutorialActive={tutorialEnabled}
          />
        )}

        {screen === 'world-selection' && (
          <Suspense fallback={null}>
            <WorldSelection
              onSelect={handleSelectWorkspace}
              onBack={handleBack}
              tutorialState={tutorialState}
            />
          </Suspense>
        )}

        {screen === 'workspace' && currentWorkspace && (
          <Suspense fallback={null}>
            <WorkspaceView workspace={currentWorkspace} onBack={handleBack} />
          </Suspense>
        )}

        {screen === 'settings' && (
          <Suspense fallback={null}>
            <SettingsScreen
              license={license}
              onStartCheckout={handleStartCheckout}
              onManageBilling={handleManageBilling}
              onStartPairing={() => window.electronAPI.licensePairingStart()}
              onClaimPairing={handleClaimPairing}
              onRefreshLicense={handleRefreshLicense}
            />
          </Suspense>
        )}
      </div>

      {/* Subscribe overlay (from trial banner) */}
      {subscribeOverlayVisible && (
        <Suspense fallback={null}>
          <SubscribeOverlay
            visible={subscribeOverlayVisible}
            onDismiss={() => setSubscribeOverlayVisible(false)}
            onStartCheckout={handleStartCheckout}
          />
        </Suspense>
      )}

      {/* Tutorial completion overlay - only show if license is active (not expired) */}
      {tutorialCompleteVisible && licenseCheckEnabled && licenseActive && !isSubscription && (
        <Suspense fallback={null}>
          <TutorialCompletionOverlay
            visible={tutorialCompleteVisible}
            showKicker={showTutorialCompleteKicker}
            onDismiss={() => {
              tutorialCompleteDismissedRef.current = true;
              setTutorialCompleteVisible(false);
            }}
            onStartCheckout={handleStartCheckout}
          />
        </Suspense>
      )}

      {/* License gate (expired trial) */}
      {showLicenseGate && (
        <Suspense fallback={licenseGateFallback}>
          <LicenseGateOverlay
            open={showLicenseGate}
            license={license}
            loadError={licenseState.error}
            tutorialCompleted={tutorialComplete}
            onStartCheckout={handleStartCheckout}
            onClaimPairing={handleClaimPairing}
            onRetry={() => void initializeLicense()}
          />
        </Suspense>
      )}

      {/* Subscription success celebration */}
      {subscriptionSuccessVisible && (
        <Suspense fallback={null}>
          <SubscriptionSuccessOverlay
            visible={subscriptionSuccessVisible}
            onDismiss={() => setSubscriptionSuccessVisible(false)}
          />
        </Suspense>
      )}
    </ThemeProvider>
  );
}
