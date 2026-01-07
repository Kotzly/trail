// Predefined tags with colors
export const TAG_PRESETS = [ // todo: add configurable presets
  { id: 'important', label: 'Important', color: '#ef4444' },
  { id: 'reference', label: 'Reference', color: '#3b82f6' },
  { id: 'todo', label: 'To Do', color: '#f59e0b' },
  { id: 'dead-end', label: 'Dead End', color: '#6b7280' },
  { id: 'bookmark', label: 'Bookmark', color: '#8b5cf6' }
] as const;

export type TagPreset = typeof TAG_PRESETS[number];

