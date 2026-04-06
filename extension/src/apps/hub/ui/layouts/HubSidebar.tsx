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
    <nav className="w-[200px] shrink-0 flex flex-col border-r bg-background py-5">
      <div className="px-5 pb-4">
        <span className="text-[15px] font-semibold tracking-tight">Trail</span>
      </div>
      <ul className="flex flex-col gap-0.5 px-2 list-none">
        {navItems.map((item) => {
          const active = isActive(currentPath, item.path);
          return (
            <li key={item.path}>
              <a
                href={`#${item.path}`}
                className={cn(
                  "block px-3 py-1.5 rounded-md text-[13px] text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-muted text-foreground font-medium",
                )}
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
