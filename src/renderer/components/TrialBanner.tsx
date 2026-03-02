interface TrialBannerProps {
  trialEndsAt: string;
  onSubscribe: () => void;
}

const formatTimeRemaining = (trialEndsAt: string): string => {
  const end = new Date(trialEndsAt).getTime();
  const now = Date.now();
  const diff = Math.max(0, end - now);

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  const parts: string[] = [];

  if (days > 0) {
    parts.push(days === 1 ? '1 day' : `${days} days`);
  }

  if (hours > 0) {
    parts.push(hours === 1 ? '1 hour' : `${hours} hours`);
  }

  if (days === 0 && minutes > 0) {
    parts.push(minutes === 1 ? '1 minute' : `${minutes} minutes`);
  }

  if (parts.length === 0) {
    return 'less than a minute';
  }

  return parts.join(', ');
};

export default function TrialBanner({ trialEndsAt, onSubscribe }: TrialBannerProps) {
  const timeText = formatTimeRemaining(trialEndsAt);

  return (
    <div className="trial-banner">
      <span className="trial-banner-text">
        Trial: <strong>{timeText} remaining</strong>
      </span>
      <button className="trial-banner-subscribe" type="button" onClick={onSubscribe}>
        Subscribe
      </button>
    </div>
  );
}
