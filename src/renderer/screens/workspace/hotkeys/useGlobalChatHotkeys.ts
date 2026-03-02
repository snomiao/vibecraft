import { useEffect } from 'react';
import { isInputCaptured } from '../inputCapture';
import type { HotkeyRouterReturn } from './useHotkeyRouter';

const GLOBAL_CHAT_HOTKEY_PRIORITY = 100;

type UseGlobalChatHotkeysParams = {
  registerHotkeyHandler: HotkeyRouterReturn['registerHotkeyHandler'];
  openGlobalChat: () => void;
  closeGlobalChat: () => void;
  isGlobalChatVisible: boolean;
};

export function useGlobalChatHotkeys({
  registerHotkeyHandler,
  openGlobalChat,
  closeGlobalChat,
  isGlobalChatVisible,
}: UseGlobalChatHotkeysParams) {
  useEffect(() => {
    return registerHotkeyHandler({
      priority: GLOBAL_CHAT_HOTKEY_PRIORITY,
      handler: (event) => {
        if (event.key === 'Escape' && isGlobalChatVisible) {
          event.preventDefault();
          closeGlobalChat();
          return true;
        }

        if (event.key !== 'Enter') return false;
        if (event.altKey || event.ctrlKey || event.metaKey) return false;
        if (isInputCaptured()) return false;
        if (isGlobalChatVisible) return false;

        event.preventDefault();
        openGlobalChat();
        return true;
      },
    });
  }, [closeGlobalChat, isGlobalChatVisible, openGlobalChat, registerHotkeyHandler]);
}

export default useGlobalChatHotkeys;
