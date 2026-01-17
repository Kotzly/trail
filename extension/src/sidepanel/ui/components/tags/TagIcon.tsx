import type { TagIconId } from './tag-icons.js';
import { getTagIcon } from './tag-icons.js';
import React from 'react';

type TagIconProps = {
  id: TagIconId | string;
  size?: number;
  className?: string;
};

export function TagIcon({ id, size = 12, className }: TagIconProps) {
  const Icon = getTagIcon(id);
  return <Icon size={size} className={className} />;
}
