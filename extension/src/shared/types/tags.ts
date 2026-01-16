import type { Tag } from './ids.js';

export type TagDefinition = {
  id: Tag;
  label: string;
  color: string;
  iconId: string;
  system?: boolean;
  createdAt?: number;
  updatedAt?: number;
};
