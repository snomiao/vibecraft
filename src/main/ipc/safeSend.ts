import type { WebContents } from 'electron';
import { isRendererReady } from '../rendererLifecycle';

export const canSendToContents = (contents: WebContents): boolean => {
  if (contents.isDestroyed()) return false;
  if (!isRendererReady(contents)) return false;
  return true;
};

export const safeWebContentsSend = (contents: WebContents, channel: string, payload: unknown): boolean => {
  if (!canSendToContents(contents)) {
    return false;
  }
  try {
    contents.send(channel, payload);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Render frame was disposed')) {
      return false;
    }
    if (error instanceof Error && error.message.includes('WebFrameMain could be accessed')) {
      return false;
    }
    throw error;
  }
};
