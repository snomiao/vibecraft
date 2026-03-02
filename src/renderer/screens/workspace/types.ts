export type DialogMessage = { title: string; message: string; type?: 'info' | 'error' | 'warning' };

export type InputConfig = {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  onConfirm: (value: string) => void;
};

export type FolderSelectDialogState = {
  title: string;
  message: string;
  onConfirm: (folderId: string) => void | Promise<void>;
  onCancel: () => void;
};
