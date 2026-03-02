interface SelectionIndicatorProps {
  active: boolean;
  variant: 'circle' | 'ring';
}

export default function SelectionIndicator({ active, variant }: SelectionIndicatorProps) {
  if (!active) return null;
  return <div className={variant === 'circle' ? 'selection-circle' : 'selection-ring'} />;
}
