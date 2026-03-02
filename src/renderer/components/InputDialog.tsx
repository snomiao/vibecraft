import React, { useState, useEffect, useRef } from 'react';

interface InputDialogProps {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export default function InputDialog({
  title,
  message,
  defaultValue = '',
  placeholder,
  onConfirm,
  onCancel,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{title}</h3>
        </div>
        {message && <div className="dialog-message">{message}</div>}
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="dialog-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus
            data-testid="dialog-input"
          />
          <div className="dialog-buttons">
            <button
              type="button"
              className="dialog-btn cancel"
              onClick={onCancel}
              data-testid="dialog-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="dialog-btn confirm"
              disabled={!value.trim()}
              data-testid="dialog-confirm"
            >
              OK
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
