// app/theme-init.tsx
export function ThemeInit() {
    const code = `(function () {
      try {
        var key = 'trail-theme';
        var stored = localStorage.getItem(key);
  
        var theme = stored || 'system';
        var resolved = theme;
  
        if (theme === 'system') {
          resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
  
        var root = document.documentElement;
  
        root.dataset.theme = resolved;
  
        root.style.colorScheme = resolved;
      } catch (e) {}
    })();`;
  
    return <script dangerouslySetInnerHTML={{ __html: code }} />;
  }
  