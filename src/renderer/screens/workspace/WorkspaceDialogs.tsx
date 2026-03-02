import InputDialog from '../../components/InputDialog';
import MessageDialog from '../../components/MessageDialog';
import FolderSelectDialog from '../../components/FolderSelectDialog';
import type { Folder } from '../../../shared/types';
import type { DialogMessage, FolderSelectDialogState, InputConfig } from './types';

interface WorkspaceDialogsProps {
  inputDialog: InputConfig | null;
  messageDialog: DialogMessage | null;
  folderSelectDialog: FolderSelectDialogState | null;
  folders: Folder[];
  onInputClose: () => void;
  onMessageClose: () => void;
}

export default function WorkspaceDialogs({
  inputDialog,
  messageDialog,
  folderSelectDialog,
  folders,
  onInputClose,
  onMessageClose,
}: WorkspaceDialogsProps) {
  return (
    <>
      {inputDialog && (
        <InputDialog
          title={inputDialog.title}
          message={inputDialog.message}
          defaultValue={inputDialog.defaultValue}
          placeholder={inputDialog.placeholder}
          onConfirm={inputDialog.onConfirm}
          onCancel={onInputClose}
        />
      )}

      {messageDialog && (
        <MessageDialog
          title={messageDialog.title}
          message={messageDialog.message}
          type={messageDialog.type}
          onClose={onMessageClose}
        />
      )}

      {folderSelectDialog && (
        <FolderSelectDialog
          title={folderSelectDialog.title}
          message={folderSelectDialog.message}
          folders={folders}
          onConfirm={folderSelectDialog.onConfirm}
          onCancel={folderSelectDialog.onCancel}
        />
      )}
    </>
  );
}
