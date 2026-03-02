import { useState, useCallback } from 'react';
import type { DialogMessage, FolderSelectDialogState, InputConfig } from './types';

export interface DialogsState {
  input: InputConfig | null;
  message: DialogMessage | null;
  folderSelect: FolderSelectDialogState | null;
}

export interface UseDialogsReturn {
  dialogs: DialogsState;
  setInputDialog: (config: InputConfig | null) => void;
  setMessageDialog: (msg: DialogMessage | null) => void;
  setFolderSelectDialog: (config: FolderSelectDialogState | null) => void;
  closeInputDialog: () => void;
  closeMessageDialog: () => void;
  closeFolderSelectDialog: () => void;
}

export function useDialogs(): UseDialogsReturn {
  const [dialogs, setDialogs] = useState<DialogsState>({
    input: null,
    message: null,
    folderSelect: null,
  });

  const setInputDialog = useCallback((config: InputConfig | null) => {
    setDialogs((prev) => ({ ...prev, input: config }));
  }, []);

  const setMessageDialog = useCallback((msg: DialogMessage | null) => {
    setDialogs((prev) => ({ ...prev, message: msg }));
  }, []);

  const setFolderSelectDialog = useCallback((config: FolderSelectDialogState | null) => {
    setDialogs((prev) => ({ ...prev, folderSelect: config }));
  }, []);

  const closeInputDialog = useCallback(() => {
    setInputDialog(null);
  }, [setInputDialog]);

  const closeMessageDialog = useCallback(() => {
    setMessageDialog(null);
  }, [setMessageDialog]);

  const closeFolderSelectDialog = useCallback(() => {
    setFolderSelectDialog(null);
  }, [setFolderSelectDialog]);

  return {
    dialogs,
    setInputDialog,
    setMessageDialog,
    setFolderSelectDialog,
    closeInputDialog,
    closeMessageDialog,
    closeFolderSelectDialog,
  };
}
