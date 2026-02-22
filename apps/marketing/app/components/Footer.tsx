type FooterLink = { label: string; href: string; isExternal?: boolean };

export function Footer({
  links,
  copyright,
}: {
  links?: FooterLink[];
  copyright?: string;
}) {
  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-text-tertiary">
          {copyright ?? `Trail \u00A9 ${new Date().getFullYear()}`}
        </p>

        {links && links.length > 0 && (
          <nav className="flex items-center gap-6">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-text-tertiary hover:text-text-secondary transition-colors"
                {...(link.isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}
      </div>
    </footer>
  );
}
