export type SidebarLabelState = {
  display: 'inline-block' | 'none';
  opacity: number;
};

export function getSidebarLabelState(open: boolean, animate: boolean): SidebarLabelState {
  if (!animate) {
    return { display: 'inline-block', opacity: 1 };
  }
  return open
    ? { display: 'inline-block', opacity: 1 }
    : { display: 'none', opacity: 0 };
}

export function getSidebarWidth(open: boolean, animate: boolean): '240px' | '72px' {
  if (!animate) {
    return '240px';
  }
  return open ? '240px' : '72px';
}
