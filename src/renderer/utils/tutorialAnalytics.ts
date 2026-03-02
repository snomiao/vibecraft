import type { TutorialStep } from '../../shared/types';
import { TUTORIAL_STEPS } from '../../shared/tutorial';
import { sendEvent, getSessionId } from './analytics';
import { startTutorialSessionReplay, stopTutorialSessionReplay } from './posthogScreenRecorder';

let tutorialStartTime: number | null = null;
let stepStartTime: number | null = null;
let lastCompletedStepId: TutorialStep | null = null;
let stepsCompleted = 0;

const getStepIndex = (stepId: TutorialStep): number => {
  return TUTORIAL_STEPS.indexOf(stepId);
};

export const trackTutorialStarted = (stepId: TutorialStep): void => {
  tutorialStartTime = Date.now();
  stepStartTime = Date.now();
  lastCompletedStepId = null;
  stepsCompleted = 0;

  startTutorialSessionReplay();

  sendEvent('tutorial_started', {
    step_id: stepId,
    step_index: getStepIndex(stepId),
  });
};

export const trackTutorialStepCompleted = (stepId: TutorialStep): void => {
  const now = Date.now();
  const timeOnStep = stepStartTime ? now - stepStartTime : 0;

  sendEvent('tutorial_step_completed', {
    step_id: stepId,
    step_index: getStepIndex(stepId),
    time_on_step_ms: timeOnStep,
  });

  stepsCompleted++;
  stepStartTime = now;
  lastCompletedStepId = stepId;
};

export const trackTutorialAbandoned = (): void => {
  if (!tutorialStartTime) return;

  stopTutorialSessionReplay();

  const now = Date.now();
  const totalTime = now - tutorialStartTime;
  const lastStepIndex = lastCompletedStepId !== null ? getStepIndex(lastCompletedStepId) : undefined;

  sendEvent('tutorial_abandoned', {
    last_step_id: lastCompletedStepId ?? undefined,
    last_step_index: lastStepIndex,
    steps_completed: stepsCompleted,
    total_time_ms: totalTime,
  });

  // Reset state
  tutorialStartTime = null;
  stepStartTime = null;
  lastCompletedStepId = null;
  stepsCompleted = 0;
};

export const trackTutorialCompleted = (): void => {
  stopTutorialSessionReplay();

  const now = Date.now();
  const totalTime = tutorialStartTime ? now - tutorialStartTime : 0;

  sendEvent('tutorial_completed', {
    total_steps: TUTORIAL_STEPS.length,
    total_time_ms: totalTime,
  });

  // Reset state
  tutorialStartTime = null;
  stepStartTime = null;
  lastCompletedStepId = null;
  stepsCompleted = 0;
};

export const getTutorialAnalyticsState = () => ({
  tutorialStartTime,
  stepStartTime,
  lastCompletedStepId,
  stepsCompleted,
  sessionId: getSessionId(),
});
