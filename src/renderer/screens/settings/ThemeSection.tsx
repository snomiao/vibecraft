export default function ThemeSection() {
  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Theme</h2>
        <p className="settings-section-subtitle">Customize the visual appearance of VibeCraft</p>
      </div>

      <div className="settings-section-content">
        <div className="settings-coming-soon-card">
          <div className="settings-coming-soon-icon">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="13.5" cy="6.5" r="2.5" />
              <circle cx="19" cy="11.5" r="2.5" />
              <circle cx="6" cy="12.5" r="2.5" />
              <circle cx="17" cy="18.5" r="2.5" />
              <circle cx="9" cy="18.5" r="2.5" />
              <path d="M12 2a10 10 0 0 0-6.88 17.23A5 5 0 0 1 9 15.5H15a5 5 0 0 1 3.88 3.73A10 10 0 0 0 12 2z" />
            </svg>
          </div>
          <h3>Visual Themes</h3>
          <p>
            Choose and customize visual themes for your VibeCraft experience. Swap out colors, icons, loading
            screens, and more.
          </p>
          <span className="settings-coming-soon-badge">Coming Soon</span>
        </div>
      </div>
    </div>
  );
}
