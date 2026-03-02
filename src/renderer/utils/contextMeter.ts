export type ContextMeterVariant = 'green' | 'yellow' | 'red';

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 100;
  return Math.max(0, Math.min(100, Math.round(value)));
};

export const normalizeContextLeftPercent = (value: unknown): number => {
  if (typeof value !== 'number') return 100;
  return clampPercent(value);
};

export const getContextMeter = (
  contextLeftPercent: unknown
): { percent: number; variant: ContextMeterVariant } => {
  const percent = normalizeContextLeftPercent(contextLeftPercent);
  const variant: ContextMeterVariant = percent < 30 ? 'red' : percent < 60 ? 'yellow' : 'green';
  return { percent, variant };
};
