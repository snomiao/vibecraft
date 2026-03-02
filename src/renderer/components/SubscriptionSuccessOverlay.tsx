import { useEffect, useRef, useState } from 'react';
import { useSoundPlayer } from '../hooks/useSoundPlayer';

interface SubscriptionSuccessOverlayProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function SubscriptionSuccessOverlay({ visible, onDismiss }: SubscriptionSuccessOverlayProps) {
  const [confettiPieces, setConfettiPieces] = useState<
    Array<{
      id: number;
      x: number;
      delay: number;
      duration: number;
      color: string;
      size: number;
      rotation: number;
    }>
  >([]);
  const { playSound } = useSoundPlayer();
  const visibleRef = useRef(false);

  useEffect(() => {
    if (visible && !visibleRef.current) {
      // Golden/amber palette matching VibeCraft aesthetic
      const colors = ['#ffd24a', '#ffb300', '#daa520', '#b8860b', '#ff9800', '#e08a00'];
      const pieces = Array.from({ length: 80 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 8,
        rotation: Math.random() * 360,
      }));
      setConfettiPieces(pieces);
      playSound('subscription.success');
      visibleRef.current = true;
      return;
    }
    if (!visible) {
      visibleRef.current = false;
    }
  }, [playSound, visible]);

  if (!visible) return null;

  return (
    <div className="subscription-success-overlay" role="dialog" aria-modal="true">
      <div className="subscription-success-confetti">
        {confettiPieces.map((piece) => (
          <div
            key={piece.id}
            className="confetti-piece"
            style={{
              left: `${piece.x}%`,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              backgroundColor: piece.color,
              width: `${piece.size}px`,
              height: `${piece.size}px`,
              transform: `rotate(${piece.rotation}deg)`,
            }}
          />
        ))}
      </div>

      <div className="subscription-success-card">
        <div className="subscription-success-glow" />

        <div className="subscription-success-crest">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>

        <h1 className="subscription-success-title">
          <span className="title-welcome">Welcome to</span>
          <span className="title-vibecraft">VibeCraft</span>
        </h1>

        <p className="subscription-success-subtitle">
          Your subscription is now active. Time to build something amazing.
        </p>

        <button className="subscription-success-btn" onClick={onDismiss}>
          Begin Your Journey
        </button>
      </div>
    </div>
  );
}
