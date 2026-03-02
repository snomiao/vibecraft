import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Folder } from '../../shared/types';
import { entityIcons } from '../assets/icons';

interface FolderSelectDialogProps {
  title?: string;
  message?: string;
  folders: Folder[];
  onConfirm: (folderId: string) => void | Promise<void>;
  onCancel: () => void;
}

export default function FolderSelectDialog({
  title = 'Select Folder',
  message,
  folders,
  onConfirm,
  onCancel,
}: FolderSelectDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleConfirm = () => {
    if (selectedId) {
      onConfirm(selectedId);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (folders.length === 0) {
    return (
      <div className="dialog-overlay" onClick={onCancel}>
        <div
          className="dialog-content"
          onClick={(e) => e.stopPropagation()}
          data-testid="folder-select-dialog"
        >
          <div className="dialog-header">
            <h3>No Folders</h3>
          </div>
          <div className="dialog-message">No folders available. Create a folder first.</div>
          <div className="dialog-buttons">
            <button className="dialog-btn confirm" onClick={onCancel} data-testid="folder-select-confirm">
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div
        className="dialog-content"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        data-testid="folder-select-dialog"
      >
        <div className="dialog-header">
          <h3>{title}</h3>
        </div>
        {message && <div className="dialog-message">{message}</div>}
        <div className="folder-select-list">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className={`folder-select-item ${selectedId === folder.id ? 'selected' : ''}`}
              onClick={() => setSelectedId(folder.id)}
              data-testid="folder-select-item"
              data-folder-id={folder.id}
              data-folder-name={folder.name}
            >
              <img className="folder-icon" src={entityIcons.folder} alt="Folder" />
              <span className="folder-name">{folder.name}</span>
            </div>
          ))}
        </div>
        <div className="dialog-buttons">
          <button
            type="button"
            className="dialog-btn cancel"
            onClick={onCancel}
            data-testid="folder-select-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="dialog-btn confirm"
            onClick={handleConfirm}
            disabled={!selectedId}
            data-testid="folder-select-confirm"
          >
            Attach
          </button>
        </div>
      </div>
    </div>
  );
}
