export const SETTINGS_SECTIONS = ['sound-pack', 'theme', 'billing'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export interface SettingsSectionConfig {
  id: SettingsSection;
  label: string;
  category: 'customization' | 'account';
  icon: 'sound' | 'theme' | 'billing';
  comingSoon?: boolean;
}

export const SETTINGS_NAV: SettingsSectionConfig[] = [
  { id: 'sound-pack', label: 'Sound Pack', category: 'customization', icon: 'sound' },
  { id: 'theme', label: 'Theme', category: 'customization', icon: 'theme', comingSoon: true },
  { id: 'billing', label: 'Subscription', category: 'account', icon: 'billing' },
];
