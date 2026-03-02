let notificationsEnabled = false;

export const setNotificationsEnabled = (enabled: boolean): void => {
  notificationsEnabled = enabled;
};

export const isNotificationsEnabled = (): boolean => notificationsEnabled;
