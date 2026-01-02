/**
 * Stack data structure for browser history tracking.
 * Implements LIFO with configurable capacity and current position tracking.
 * Tracks browser history index for instant back-forward navigation via bfcache.
 */
export class Stack {
  /**
   * @param {number} capacity - Maximum number of items the stack can hold
   */
  constructor(capacity = 100) {
    this.items = [];
    this.capacity = capacity;
    this.currentIndex = -1; // Index of currently viewed page (-1 = none)
    this.historyLength = 0; // Browser's history.length at last navigation
  }

  /**
   * Push a new entry onto the stack.
   * If at capacity, removes the oldest (bottom) item.
   * Avoids duplicate consecutive entries.
   * @param {StackEntry} entry
   * @param {boolean} isUserNavigation - True if triggered by user clicking in stack
   */
  push(entry, isUserNavigation = false) {
    // If this is a user navigation to an existing entry, just update currentIndex
    if (isUserNavigation) {
      const existingIndex = this.items.findIndex(item => item.url === entry.url);
      if (existingIndex !== -1) {
        this.currentIndex = existingIndex;
        // Update timestamp on the existing entry
        this.items[existingIndex].timestamp = entry.timestamp;
        return;
      }
    }

    // Check if navigating to the same URL as current position
    const currentItem = this.items[this.currentIndex];
    if (currentItem && currentItem.url === entry.url) {
      // Just update metadata
      currentItem.timestamp = entry.timestamp;
      if (entry.title && entry.title !== currentItem.title) {
        currentItem.title = entry.title;
      }
      if (entry.favicon) {
        currentItem.favicon = entry.favicon;
      }
      return;
    }

    // Avoid duplicate consecutive entries (same URL as last item)
    const lastItem = this.items[this.items.length - 1];
    if (lastItem && lastItem.url === entry.url) {
      // Update timestamp and title if changed
      lastItem.timestamp = entry.timestamp;
      if (entry.title && entry.title !== lastItem.title) {
        lastItem.title = entry.title;
      }
      this.currentIndex = this.items.length - 1;
      return;
    }

    // Enforce capacity by removing oldest item
    if (this.items.length >= this.capacity) {
      this.items.shift();
      // Adjust currentIndex since we removed an item at the beginning
      if (this.currentIndex > 0) {
        this.currentIndex--;
      }
    }

    // Store browser history index for this entry
    entry.historyIndex = this.historyLength;
    
    this.items.push(entry);
    this.currentIndex = this.items.length - 1; // Point to the new entry
  }

  /**
   * Update the browser history length.
   * @param {number} length
   */
  setHistoryLength(length) {
    this.historyLength = length;
  }

  /**
   * Get history length.
   * @returns {number}
   */
  getHistoryLength() {
    return this.historyLength;
  }

  /**
   * Calculate delta for history.go() to navigate to a specific stack entry.
   * @param {number} targetIndex - Target stack index
   * @returns {number|null} - Delta for history.go(), or null if not possible
   */
  getHistoryDelta(targetIndex) {
    const currentItem = this.items[this.currentIndex];
    const targetItem = this.items[targetIndex];
    
    if (!currentItem || !targetItem) return null;
    if (currentItem.historyIndex === undefined || targetItem.historyIndex === undefined) return null;
    
    return targetItem.historyIndex - currentItem.historyIndex;
  }

  /**
   * Set current index (for navigation within stack).
   * @param {number} index
   */
  setCurrentIndex(index) {
    if (index >= 0 && index < this.items.length) {
      this.currentIndex = index;
    }
  }

  /**
   * Get current index.
   * @returns {number}
   */
  getCurrentIndex() {
    return this.currentIndex;
  }

  /**
   * Get item at specific index.
   * @param {number} index
   * @returns {StackEntry|undefined}
   */
  getAt(index) {
    return this.items[index];
  }

  /**
   * Find index of item by URL.
   * @param {string} url
   * @returns {number} Index or -1 if not found
   */
  findByUrl(url) {
    return this.items.findIndex(item => item.url === url);
  }

  /**
   * Remove and return the top entry.
   * @returns {StackEntry|undefined}
   */
  pop() {
    const item = this.items.pop();
    if (this.currentIndex >= this.items.length) {
      this.currentIndex = this.items.length - 1;
    }
    return item;
  }

  /**
   * View the top entry without removing it.
   * @returns {StackEntry|undefined}
   */
  peek() {
    return this.items[this.items.length - 1];
  }

  /**
   * Get all items in chronological order (oldest first, newest last).
   * @returns {StackEntry[]}
   */
  getAll() {
    return [...this.items];
  }

  /**
   * Get the number of items in the stack.
   * @returns {number}
   */
  size() {
    return this.items.length;
  }

  /**
   * Check if stack is empty.
   * @returns {boolean}
   */
  isEmpty() {
    return this.items.length === 0;
  }

  /**
   * Clear all items from the stack.
   */
  clear() {
    this.items = [];
    this.currentIndex = -1;
    this.historyLength = 0;
  }

  /**
   * Update capacity. If new capacity is smaller, trims oldest entries.
   * @param {number} newCapacity
   */
  setCapacity(newCapacity) {
    this.capacity = newCapacity;
    while (this.items.length > this.capacity) {
      this.items.shift();
      if (this.currentIndex > 0) {
        this.currentIndex--;
      }
    }
  }

  /**
   * Serialize stack for storage.
   * @returns {object}
   */
  toJSON() {
    return {
      items: this.items,
      capacity: this.capacity,
      currentIndex: this.currentIndex,
      historyLength: this.historyLength
    };
  }

  /**
   * Create Stack instance from serialized data.
   * @param {object} data
   * @returns {Stack}
   */
  static fromJSON(data) {
    const stack = new Stack(data.capacity || 100);
    stack.items = data.items || [];
    stack.currentIndex = data.currentIndex ?? (stack.items.length - 1);
    stack.historyLength = data.historyLength || 0;
    return stack;
  }
}

/**
 * @typedef {Object} StackEntry
 * @property {string} url - The page URL
 * @property {string} title - The page title
 * @property {string} [favicon] - Favicon URL
 * @property {number} timestamp - Unix timestamp when visited
 * @property {number} [historyIndex] - Browser history index for bfcache navigation
 */
