import type { FaviconUrl } from "../../../shared/types/ids";

export function createFaviconElement(faviconUrl: FaviconUrl): HTMLElement {
    const container = document.createElement('div');
    container.className = 'entry-icon';
    
    if (faviconUrl) {
      const img = document.createElement('img');
      img.src = faviconUrl;
      img.alt = '';
      img.onerror = () => {
        container.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v8M8 12h8"/>
          </svg>
        `;
      };
      container.appendChild(img);
    } else {
      container.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v8M8 12h8"/>
        </svg>
      `;
    }
    
    return container;
}
