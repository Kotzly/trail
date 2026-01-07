import { PanelState } from "../state/panel-state";
import { NodeId } from "../../shared/types/ids";
import { navigateTo } from "../api/tree";

  
// Open pinned dropdown and populate with pinned nodes.
export function openPinnedDropdown(): void {
    const dropdown = document.getElementById('pinnedDropdown');
    const list = document.getElementById('pinnedList');
    const count = document.getElementById('pinnedCount');
    
    if (!dropdown || !list || !count) return;
    if (!PanelState.pins) {
        console.warn('Pinned manager not initialized');
        return;
    }

    const pins = PanelState.pins.pinned;
    
    // Update count
    count.textContent = pins.size.toString();
    
    // Populate list
    if (pins.size === 0) {
      list.innerHTML = '<div class="pinned-dropdown-empty">No pinned pages</div>';
    } else {
      list.innerHTML = Array.from(pins).map((node, idx) => {
        let domain = '';
        try {
          domain = new URL(node.url).hostname;
        } catch (e) {
          domain = node.url;
        }
        
        return `
          <div class="pinned-dropdown-item${idx === 0 ? ' focused' : ''}" data-node-id="${node.id}">
            ${node.favicon 
              ? `<img class="pinned-dropdown-item-favicon" src="${node.favicon}" alt="">` 
              : `<div class="pinned-dropdown-item-favicon placeholder">📌</div>`}
            <div class="pinned-dropdown-item-info">
              <div class="pinned-dropdown-item-title">${node.title || 'Untitled'}</div>
              <div class="pinned-dropdown-item-url">${domain}</div>
            </div>
          </div>
        `;
      }).join('');
      
      // Add click handlers
      list.querySelectorAll('.pinned-dropdown-item').forEach((item, idx) => {
        const itemEl = item as HTMLElement;
        itemEl.addEventListener('click', () => {
          const nodeId = parseInt(itemEl.dataset.nodeId || '0', 10) as NodeId;
          const node = Array.from(pins).find(n => n.id === nodeId);
          if (node) {
            navigateTo(node);
            closePinnedDropdown();
          }
        });
      });
    }
    
    dropdown.classList.remove('hidden');
  }
  
  // Close pinned dropdown.
function closePinnedDropdown(): void {
    const dropdown = document.getElementById('pinnedDropdown');
    if (dropdown) {
      dropdown.classList.add('hidden');
    }
  }
  
export function togglePinnedDropdown(): void {
    const dropdown = document.getElementById('pinnedDropdown');
    if (!dropdown) return;
    if (dropdown.classList.contains('hidden')) {
        openPinnedDropdown();
    } else {
        closePinnedDropdown();
    }
}

export function pinnedDropdownOpen(): boolean {
    const dropdown = document.getElementById('pinnedDropdown');
    if (!dropdown) return false;
    return !dropdown.classList.contains('hidden');
}