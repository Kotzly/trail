// app/theme-init.tsx
export function ThemeInit() {
  // Inline script that runs before first paint to prevent flash.
  // Marketing site always follows system preference via data-theme="system";
  // CSS @media rules handle the actual light/dark switching.
  const code = `(function () {
      try {
        var root = document.documentElement;
        try { localStorage.removeItem('trail-theme'); } catch (_) {}
        root.dataset.theme = 'system';
      } catch (e) {}
    })();`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
