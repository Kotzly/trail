import { useCurrentPath } from '../router.js';

type NavItem = {
  label: string;
  path: string;
};

const navItems: NavItem[] = [
  { label: 'Trails', path: '/trails' },
  { label: 'Settings', path: '/settings' },
  { label: 'Billing', path: '/billing' },
  { label: 'Activity', path: '/activity' },
  { label: 'Getting Started', path: '/getting-started' },
];

function isActive(currentPath: string, itemPath: string): boolean {
  if (itemPath === '/trails') {
    return currentPath === '/trails' || currentPath.startsWith('/trails/');
  }
  return currentPath === itemPath;
}

export default function AccountSidebar() {
  const currentPath = useCurrentPath();

  return (
    <nav className="account-sidebar">
      <div className="account-sidebar__header">
        <span className="account-sidebar__brand">Trail</span>
      </div>
      <ul className="account-sidebar__nav">
        {navItems.map((item) => {
          const active = isActive(currentPath, item.path);
          return (
            <li key={item.path}>
              <a
                href={`#${item.path}`}
                className={`account-sidebar__link${active ? ' account-sidebar__link--active' : ''}`}
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
