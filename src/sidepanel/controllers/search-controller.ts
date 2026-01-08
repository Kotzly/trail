import { NodeId } from "../../shared/types/ids";
import { PanelState } from "../state/panel-state";
import { GraphState } from "../ui/graph/state/graph-state";

// Search through tree data for matching nodes.
function searchNodes(query: string): NodeId[] {
    if (!query || !PanelState.tree) return [];
    return PanelState.tree.findNodesByQuery(query);
}
  
  // Perform search and update UI.
export function performSearch(query: string): void {
    PanelState.search.query = query;
    PanelState.search.results = searchNodes(query);
    PanelState.search.index = 0;
    
    updateSearchUI();
    applySearchHighlights();
    
    if (PanelState.search.results.length > 0) {
        focusSearchResult(0);
    }
}
  
// Update search UI with results count.
function updateSearchUI(): void {
    const searchResultsEl = document.getElementById('searchResults');
    const searchCountEl = document.getElementById('searchCount');
    const searchClearEl = document.getElementById('searchClear');
    
    if (PanelState.search.query) {
      if (searchResultsEl) searchResultsEl.classList.remove('hidden');
      if (searchClearEl) searchClearEl.classList.remove('hidden');
      
      if (PanelState.search.results.length === 0) {
        if (searchCountEl) searchCountEl.textContent = 'No results';
      } else {
        if (searchCountEl) searchCountEl.textContent = `${PanelState.search.index + 1} of ${PanelState.search.results.length}`;
      }
    } else {
      if (searchResultsEl) searchResultsEl.classList.add('hidden');
      if (searchClearEl) searchClearEl.classList.add('hidden');
    }
}
  
// Apply search highlights to matching nodes.
function applySearchHighlights() {
    // Remove existing highlights
    document.querySelectorAll('.search-match, .search-dimmed, .search-focused').forEach(el => {
      el.classList.remove('search-match', 'search-dimmed', 'search-focused');
    });
    
    if (!PanelState.search.query || PanelState.search.results.length === 0) return;
    
    // Apply dimmed class to all nodes
    document.querySelectorAll('.graph-node, .tree-node, .stack-entry').forEach(el => {
      el.classList.add('search-dimmed');
    });
    
    // Apply match class to matching nodes
    PanelState.search.results.forEach((nodeId, idx) => {
        const el = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (el) {
            el.classList.remove('search-dimmed');
            el.classList.add('search-match');
            if (idx === PanelState.search.index) {
                el.classList.add('search-focused');
            }
        }
    });
}
  
  // Focus on a specific search result.
function focusSearchResult(index: number): void {
    if (PanelState.search.results.length === 0) return;
    
    PanelState.search.index = ((index % PanelState.search.results.length) + PanelState.search.results.length) % PanelState.search.results.length;
    const nodeId = PanelState.search.results[PanelState.search.index];
    if (!nodeId) return;
    
    updateSearchUI();
    applySearchHighlights();
    
    // Center on the node in graph view
    const graphAPI = GraphState.getGraphAPI();
    if (graphAPI && graphAPI.centerOnNode) {
        graphAPI.centerOnNode(nodeId, true);
    } else {
        // Scroll into view for other views
        const el = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}
  
  // Clear search and reset UI.
export function clearSearch(): void {
    PanelState.search.query = '';
    PanelState.search.results = [];
    PanelState.search.index = 0;
    
    const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';
    
    updateSearchUI();
    applySearchHighlights();
}