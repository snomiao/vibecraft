const CAPTURE_SELECTORS = [
  '.browser-entity-wrapper',
  '.terminal-panel',
  '.agent-terminal-panel',
  '.dialog',
  '.modal',
  '.global-chat-interface',
  '[data-capture-input]',
].join(', ');

export const isInputCaptured = (): boolean => {
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (active.isContentEditable) return true;
  return Boolean(active.closest(CAPTURE_SELECTORS));
};

export default isInputCaptured;
