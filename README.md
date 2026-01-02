# trail

Trail is a browser extension for Brave.
The extension is put in the sidebar.
After it has been installed, it starts tracking the user's activities, most prominently,
the user's clicks on links.
It represents the history of the user's clicks in a stack, the LIFO data structure.
The history is shown as a clickable diagram going down, with each web page clickable.
The extension is configurable for the max amount (N) of cached links. For example: it can store the last 10 web pages to 
avoid reloading it upon click.
The extension can also be configured to store N links, i.e. the capacity of the stack.
The stack diagram is scrollable.
Clicking on an object, when stored in memory, instantly opens it in the same tab.
Each new tab in a browser with this extension is working as a separate environment, with different stacks.

## Installation

1. Open Brave browser and navigate to `brave://extensions/`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked** and select the `stack-history` folder
4. The extension icon will appear in your toolbar
5. Click the icon to open the side panel

## Features

- **Per-tab stacks**: Each browser tab maintains its own independent navigation stack
- **LIFO visualization**: See your browsing history as a vertical stack with the most recent page at the top
- **Quick navigation**: Click any entry to instantly navigate back to that page
- **Cached indicators**: Top N entries are highlighted (configurable) for quick identification
- **SPA support**: Tracks History API navigations in single-page applications
- **Configurable**: Adjust stack capacity and cached links count in settings

## Configuration

Click the gear icon in the side panel to access settings:

- **Stack Capacity**: Maximum pages to remember per tab (10-1000)
- **Cached Links**: Number of recent entries to highlight (0-100)

## Project Structure

```
stack-history/
├── manifest.json           # Extension manifest (MV3)
├── service-worker.js       # Background service worker
├── sidepanel/
│   ├── sidepanel.html      # Sidebar UI
│   ├── sidepanel.css       # Sidebar styles
│   └── sidepanel.js        # Sidebar logic
├── options/
│   ├── options.html        # Settings page
│   ├── options.css
│   └── options.js
├── lib/
│   ├── stack.js            # Stack data structure
│   └── storage-manager.js  # Storage abstraction
└── icons/
    └── icon*.svg           # Extension icons
```

## Technical Notes

- Uses Chrome Manifest V3 (compatible with Brave)
- `chrome.sidePanel` API for sidebar integration
- `chrome.webNavigation` for tracking link clicks and SPA navigation
- `chrome.storage.session` for ephemeral per-tab state
- `chrome.storage.sync` for persistent settings