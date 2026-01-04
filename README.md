# Trail

Trail is a browser extension for Chrome/Brave that visualizes your browsing history as an interactive navigation tree. Instead of a linear history, Trail shows how you actually browse - with branches, forks, and parallel explorations.

## Features

### View Modes
- **Graph View** - Interactive canvas with pan/zoom, shows your browsing as a visual tree
- **Tree View** - Collapsible hierarchical list, great for deep navigation structures  
- **Stack View** - Simple linear stack, LIFO-style history

### Multi-Tab Mode
- **Global Navigation Graph** - One unified tree across all browser windows
- **Visual Tab States** - See which nodes have open tabs, which are closed
- **Audio Indicators** - Speaker icons on tabs playing audio, click to mute
- **Muted Tab Indicators** - Red border on muted tabs
- **Window Focus** - Clicking a node focuses the correct window and tab

### Forest Mode
- Each new tab starts its own separate tree
- Multiple roots displayed side-by-side
- Great for parallel research sessions

### Smart Navigation
- **Back on Revisit** - Scrolling back to a previously visited URL (like YouTube Shorts) navigates to the existing node instead of creating duplicates
- **Context Menu** - Right-click any node to "Open in this tab"
- **SPA Support** - Tracks History API navigations in single-page applications

### Compact Graph Mode
- Smaller nodes showing page title only
- Tighter spacing for dense trees
- URL shown on hover

### Search (Cmd/Ctrl+F)
- Search by page title, URL, or domain
- Highlights matching nodes, dims others
- Navigate through results with arrow keys
- Enter to go to node, Shift+Enter to open in new tab

### Pin Nodes
- Pin important pages to protect from LRU eviction
- Pinned nodes marked with 📌 and golden border
- Right-click → Pin node

### Tags / Labels
- Add colored tags to organize pages
- Predefined tags: Important, Reference, To Do, Dead End, Bookmark
- Right-click → Tags to add/remove
- Colored dots shown on tagged nodes

### Additional Features
- Click any node to navigate and smoothly center view
- Pinch-to-zoom and scroll zoom on trackpad
- Keyboard shortcuts (+/- for zoom, 0 to reset)
- Dark/light theme support
- Configurable limits for cached pages and open tabs
- A/B feature flags to enable/disable Search, Pin, Tags

## Installation

1. Open Chrome/Brave and navigate to `chrome://extensions/` or `brave://extensions/`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked** and select the `trail` folder
4. The extension icon will appear in your toolbar
5. Click the icon to open the side panel

## Configuration

Click the gear icon in the side panel to access settings:

- **View Mode** - Graph, Tree, or Stack
- **Multi-Tab Mode** - Enable global graph with multiple open tabs
- **Multi-Tab Limit** - Maximum concurrent tabs to keep open
- **Forest Mode** - Separate tree per new tab
- **Back on Revisit** - Navigate to ancestor on duplicate URLs
- **Compact Graph** - Use smaller, denser graph layout
- **Stack Capacity** - Maximum pages to remember (10-1000)
- **Cached Links** - Recent entries to keep in memory (0-100)

**Feature Flags:**
- **Search** - Enable search functionality (Cmd/Ctrl+F)
- **Pin Nodes** - Enable pinning nodes for LRU protection
- **Tags** - Enable tagging nodes with colored labels

## Project Structure

```
trail/
├── manifest.json           # Extension manifest (MV3)
├── service-worker.js       # Background service worker
├── sidepanel/
│   ├── sidepanel.html      # Side panel UI
│   ├── sidepanel.css       # Styles (Material Design 3)
│   └── sidepanel.js        # Side panel logic
├── content/
│   └── content-script.js   # Page content script
├── lib/
│   ├── tree.js             # NavigationTree data structure
│   ├── graph-renderer.js   # Interactive graph canvas
│   ├── tree-renderer.js    # Collapsible tree view
│   ├── stack-renderer.js   # Linear stack view
│   ├── renderers.js        # Renderer utilities
│   ├── view-modes.js       # View mode constants
│   ├── storage-manager.js  # Storage abstraction
│   ├── tab-manager.js      # Tab ↔ Node mapping
│   ├── stack.js            # Stack data structure
│   └── themes.js           # Theme management
└── icons/
    └── icon*.svg/png       # Extension icons
```

## Technical Notes

- Chrome Manifest V3 compatible
- `chrome.sidePanel` API for sidebar integration
- `chrome.webNavigation` for tracking navigations
- `chrome.storage.session` for ephemeral state
- `chrome.storage.sync` for persistent settings
- Canvas-based graph with smooth pan/zoom
- Tree data structure with forest support
- LRU eviction for tab limits
