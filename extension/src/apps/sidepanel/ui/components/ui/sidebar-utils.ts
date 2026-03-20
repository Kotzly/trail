export type SidebarLabelState = {
  display: "inline-block" | "none";
  opacity: number;
};

export function getSidebarLabelState(open: boolean, animate: boolean): SidebarLabelState {
  if (!animate) {
    return { display: "inline-block", opacity: 1 };
  }
  return open ? { display: "inline-block", opacity: 1 } : { display: "none", opacity: 0 };
}

export function getSidebarWidth(open: boolean, animate: boolean): "180px" | "72px" {
  if (!animate) {
    return "180px";
  }
  return open ? "180px" : "72px";
}
