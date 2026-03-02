interface MessageDialogProps {
  title: string;
  message: string;
  type?: 'info' | 'error' | 'warning';
  onClose: () => void;
}

export default function MessageDialog({ title, message, type = 'info', onClose }: MessageDialogProps) {
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{title}</h3>
        </div>
        <div className={`dialog-message dialog-${type}`}>{message}</div>
        <div className="dialog-buttons">
          <button className="dialog-btn confirm" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
