import type { AvailableFolder, Folder } from '../../../shared/types';
import { sanitizeFolderRelativeName } from '../../../shared/pathUtils';

const DEFAULT_PROJECT_NAMES = [
  'Rivendell',
  'Weathertop',
  'Moria',
  'Lothlorien',
  'Fangorn',
  'Rohan',
  'Edoras',
  'Helms-Deep',
  'Gondor',
  'Minas-Tirith',
  'Osgiliath',
  'Pelennor',
  'Isengard',
  'Orthanc',
  'Mordor',
  'Minas-Morgul',
  'Barad-dur',
  'Mirkwood',
  'Dol-Guldur',
  'Erebor',
  'Grey-Havens',
  'Umbar',
  'Harad',
  'Rhun',
  'Eregion',
  'Numenor',
  'Valinor',
];

const FALLBACK_PREFIX = 'Middle-earth';

const normalizeName = (value: string): string => sanitizeFolderRelativeName(value).toLowerCase();

const collectUsedNames = (folders: Folder[], availableFolders: AvailableFolder[]): Set<string> => {
  const used = new Set<string>();
  const add = (value?: string | null) => {
    if (!value) return;
    const normalized = normalizeName(value);
    if (normalized) used.add(normalized);
  };

  for (const folder of folders) {
    add(folder.relativePath || folder.name);
  }

  const visit = (entries: AvailableFolder[]) => {
    for (const entry of entries) {
      add(entry.relativePath || entry.name);
      if (entry.children?.length) {
        visit(entry.children);
      }
    }
  };

  visit(availableFolders);
  return used;
};

export function getNextDefaultProjectName(options: {
  folders: Folder[];
  availableFolders: AvailableFolder[];
}): string {
  const used = collectUsedNames(options.folders, options.availableFolders);

  for (const candidate of DEFAULT_PROJECT_NAMES) {
    const sanitized = sanitizeFolderRelativeName(candidate);
    if (!sanitized) continue;
    if (!used.has(normalizeName(sanitized))) {
      return sanitized;
    }
  }

  let index = 1;
  while (index < 10_000) {
    const candidate = `${FALLBACK_PREFIX}-${index}`;
    const sanitized = sanitizeFolderRelativeName(candidate);
    if (sanitized && !used.has(normalizeName(sanitized))) {
      return sanitized;
    }
    index += 1;
  }

  return sanitizeFolderRelativeName(`Project-${Date.now()}`) || 'Project';
}
