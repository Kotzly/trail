import { useCurrentPath } from "../router.js";
import { cn } from "../../../../ui/lib/utils.js";

type NavItem = {
  label: string;
  path: string;
};

const navItems: NavItem[] = [
  { label: "Trails", path: "/trails" },
  { label: "Settings", path: "/settings" },
  { label: "Billing", path: "/billing" },
  { label: "Activity", path: "/activity" },
  { label: "Getting Started", path: "/getting-started" },
];

function isActive(currentPath: string, itemPath: string): boolean {
  if (itemPath === "/trails") {
    return currentPath === "/trails" || currentPath.startsWith("/trails/");
  }
  return currentPath === itemPath;
}

export default function HubSidebar() {
  const currentPath = useCurrentPath();

  return (
    <nav className="hub-sidebar">
      <div className="hub-sidebar__header">
        <span className="hub-sidebar__brand">Trail</span>
      </div>
      <ul className="hub-sidebar__nav">
        {navItems.map((item) => {
          const active = isActive(currentPath, item.path);
          return (
            <li key={item.path}>
              <a
                href={`#${item.path}`}
                className={cn("hub-sidebar__link", active && "hub-sidebar__link--active")}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
