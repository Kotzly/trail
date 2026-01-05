/**
 * Tree data structure for browser history tracking.
 * Supports multiple roots (forest) - each new tab creates a new tree.
 * Each node represents a page, children represent pages navigated from that page.
 * 
 * ARCHITECTURE NOTES:
 * - The tree supports both mutable and immutable patterns
 * - For undo/redo, use toJSON() to capture state before mutations
 * - Use clone() to create a deep copy for isolated modifications
 * - Use toImmutableSnapshot() to get a frozen snapshot for rendering
 * 
 * Future improvements:
 * - Migrate mutation methods to return new tree state instead of mutating in place
 * - Implement structural sharing for memory-efficient immutable updates
 */

let nodeIdCounter = 0;

export class TreeNode {
  constructor(entry) {
    this.id = ++nodeIdCounter;
    this.url = entry.url;
    this.title = entry.title || entry.url;
    this.favicon = entry.favicon || '';
    this.timestamp = entry.timestamp || Date.now();
    this.children = [];
    this.parent = null;
    this.collapsed = false;
    this.pinned = false;    // Pin/lock node (protected from LRU eviction)
    this.tags = [];         // Array of tag IDs
    this.isRoot = entry.isRoot || false; // Root nodes cannot be deleted
    // Owner window for root nodes (used when multiple windows have their own trees)
    this.windowId = entry.windowId ?? null;
  }

  addChild(entry) {
    const child = new TreeNode(entry);
    child.parent = this;
    this.children.push(child);
    return child;
  }

  toJSON() {
    return {
      id: this.id,
      url: this.url,
      title: this.title,
      favicon: this.favicon,
      timestamp: this.timestamp,
      collapsed: this.collapsed,
      pinned: this.pinned,
      tags: this.tags,
      isRoot: this.isRoot,
      windowId: this.windowId,
      children: this.children.map(c => c.toJSON())
    };
  }

  static fromJSON(json, parent = null) {
    const node = new TreeNode({
      url: json.url,
      title: json.title,
      favicon: json.favicon,
      timestamp: json.timestamp,
      isRoot: json.isRoot,
      windowId: json.windowId
    });
    node.id = json.id;
    node.collapsed = json.collapsed || false;
    node.pinned = json.pinned || false;
    node.tags = json.tags || [];
    node.parent = parent;
    node.children = (json.children || []).map(c => TreeNode.fromJSON(c, node));
    
    // Update counter to avoid ID collisions
    if (json.id >= nodeIdCounter) {
      nodeIdCounter = json.id + 1;
    }
    
    return node;
  }
}

export class NavigationTree {
  constructor(capacity = 100) {
    this.roots = [];  // Array of root nodes (forest)
    this.currentNode = null;
    this.capacity = capacity;
    this.nodeCount = 0;
  }

  // Legacy getter for backwards compatibility
  get root() {
    return this.roots[0] || null;
  }

  /**
   * Navigate to a new page from the current node.
   * Creates a new child node under currentNode.
   * If no currentNode exists, creates a new root.
   * If URL exists as ancestor and backOnRevisit is true, navigates back to that ancestor.
   * @param {object} entry - Page entry { url, title, favicon, timestamp }
   * @param {object} options - Navigation options { backOnRevisit: boolean }
   */
  navigate(entry, options = {}) {
    const { backOnRevisit = true } = options;

    // Check if navigating to the same URL as current
    if (this.currentNode && this.currentNode.url === entry.url) {
      // Update metadata only
      this.currentNode.title = entry.title || this.currentNode.title;
      this.currentNode.favicon = entry.favicon || this.currentNode.favicon;
      this.currentNode.timestamp = entry.timestamp;
      return this.currentNode;
    }

    // Check if this URL already exists as a child of current node
    if (this.currentNode) {
      const existingChild = this.currentNode.children.find(c => c.url === entry.url);
      if (existingChild) {
        existingChild.timestamp = entry.timestamp;
        this.currentNode = existingChild;
        return existingChild;
      }
    }

    // Check if this URL exists as an ancestor (going back up the tree)
    // This handles cases like scrolling back up in YouTube Shorts
    if (backOnRevisit && this.currentNode) {
      let ancestor = this.currentNode.parent;
      while (ancestor) {
        if (ancestor.url === entry.url) {
          // Navigate back to existing ancestor instead of creating duplicate
          ancestor.timestamp = entry.timestamp;
          this.currentNode = ancestor;
          return ancestor;
        }
        ancestor = ancestor.parent;
      }
    }

    // Create new node
    if (this.currentNode) {
      // Add as child of current node (creates branch)
      const newNode = this.currentNode.addChild(entry);
      this.currentNode = newNode;
      this.nodeCount++;
    } else {
      // No current node - create as new root (marked as undeletable)
      const newRoot = new TreeNode({ ...entry, isRoot: true });
      this.roots.push(newRoot);
      this.currentNode = newRoot;
      this.nodeCount++;
    }

    // Enforce capacity by pruning oldest branches
    this._enforceCapacity();

    return this.currentNode;
  }

  /**
   * Create a new root (new tab opened, not a navigation from existing page).
   * @param {object} entry - Page entry { url, title, favicon, timestamp }
   * @returns {TreeNode} - The new root node
   */
  createNewRoot(entry) {
    // Mark as root node (cannot be deleted)
    const newRoot = new TreeNode({ ...entry, isRoot: true });
    this.roots.push(newRoot);
    this.currentNode = newRoot;
    this.nodeCount++;
    this._enforceCapacity();
    return newRoot;
  }

  /**
   * Set the current node by ID (for clicking in sidebar).
   */
  setCurrentById(nodeId) {
    const node = this.findNodeById(nodeId);
    if (node) {
      this.currentNode = node;
      return true;
    }
    return false;
  }

  /**
   * Get current node ID.
   */
  getCurrentId() {
    return this.currentNode?.id || null;
  }

  /**
   * Toggle collapsed state of a node.
   */
  toggleCollapsed(nodeId) {
    const node = this.findNodeById(nodeId);
    if (node) {
      node.collapsed = !node.collapsed;
      return true;
    }
    return false;
  }

  /**
   * Toggle pinned state of a node.
   * @param {number} nodeId
   * @returns {boolean|null} - New pinned state, or null if node not found
   */
  togglePinned(nodeId) {
    const node = this.findNodeById(nodeId);
    if (node) {
      node.pinned = !node.pinned;
      return node.pinned;
    }
    return null;
  }

  /**
   * Toggle pinned state for a node and all its descendants (branch).
   * Used when pinSyncBrowser is enabled.
   * @param {number} nodeId
   * @returns {boolean|null} - New pinned state, or null if node not found
   */
  togglePinnedBranch(nodeId) {
    const node = this.findNodeById(nodeId);
    if (!node) return null;
    
    const newState = !node.pinned;
    
    // Recursively set pinned state for node and all descendants
    const setPinnedRecursive = (n) => {
      n.pinned = newState;
      if (n.children) {
        n.children.forEach(setPinnedRecursive);
      }
    };
    
    setPinnedRecursive(node);
    return newState;
  }

  /**
   * Set tags for a node.
   * @param {number} nodeId
   * @param {string[]} tags - Array of tag IDs
   * @returns {boolean} - Success
   */
  setTags(nodeId, tags) {
    const node = this.findNodeById(nodeId);
    if (node) {
      node.tags = tags || [];
      return true;
    }
    return false;
  }

  /**
   * Add a tag to a node.
   * @param {number} nodeId
   * @param {string} tagId
   * @returns {boolean} - Success
   */
  addTag(nodeId, tagId) {
    const node = this.findNodeById(nodeId);
    if (node) {
      if (!node.tags.includes(tagId)) {
        node.tags.push(tagId);
      }
      return true;
    }
    return false;
  }

  /**
   * Remove a tag from a node.
   * @param {number} nodeId
   * @param {string} tagId
   * @returns {boolean} - Success
   */
  removeTag(nodeId, tagId) {
    const node = this.findNodeById(nodeId);
    if (node) {
      node.tags = node.tags.filter(t => t !== tagId);
      return true;
    }
    return false;
  }

  /**
   * Remove all children of a node (keeps the node itself).
   * @param {number} nodeId
   * @returns {number[]} - Array of removed node IDs (for closing tabs)
   */
  removeChildren(nodeId) {
    const node = this.findNodeById(nodeId);
    if (!node) return [];
    
    const removedIds = this._collectNodeIds(node.children);
    const removedCount = removedIds.length;
    node.children = [];
    this.nodeCount -= removedCount;
    
    return removedIds;
  }

  /**
   * Remove a node and all its children.
   * For root nodes, this removes the entire tree.
   * @param {number} nodeId
   * @returns {number[]} - Array of removed node IDs (for closing tabs)
   */
  removeNodeWithChildren(nodeId) {
    const node = this.findNodeById(nodeId);
    if (!node) return [];
    
    // Collect all IDs including this node
    const removedIds = [node.id, ...this._collectNodeIds(node.children)];
    const removedCount = removedIds.length;
    
    // If it's a root, remove from roots array
    const rootIdx = this.roots.indexOf(node);
    if (rootIdx >= 0) {
      this.roots.splice(rootIdx, 1);
    } else if (node.parent) {
      // Remove from parent's children
      node.parent.children = node.parent.children.filter(c => c !== node);
    }
    
    // Update current node if needed
    if (removedIds.includes(this.currentNode?.id)) {
      this.currentNode = node.parent || (this.roots.length > 0 ? this.roots[0] : null);
    }
    
    this.nodeCount -= removedCount;
    return removedIds;
  }

  /**
   * Collect all node IDs in a subtree.
   * @param {TreeNode[]} nodes - Array of nodes to traverse
   * @returns {number[]} - Array of node IDs
   */
  _collectNodeIds(nodes) {
    const ids = [];
    const traverse = (node) => {
      ids.push(node.id);
      node.children.forEach(traverse);
    };
    nodes.forEach(traverse);
    return ids;
  }

  /**
   * Remove multiple nodes and reconnect their children to their parents.
   * This "shortens" branches by removing intermediate nodes.
   * @param {number[]} nodeIds - Array of node IDs to remove
   * @returns {number[]} - Array of removed node IDs (for closing tabs)
   */
  removeNodesAndReconnect(nodeIds) {
    const idsToRemove = new Set(nodeIds);
    const removedIds = [];
    
    // Sort nodes by depth (deepest first) to handle correctly
    // Skip root nodes - they cannot be deleted
    const nodesWithDepth = nodeIds
      .map(id => ({ id, node: this.findNodeById(id) }))
      .filter(({ node }) => node !== null && !node.isRoot)
      .map(({ id, node }) => {
        let depth = 0;
        let current = node;
        while (current.parent) {
          depth++;
          current = current.parent;
        }
        return { id, node, depth };
      })
      .sort((a, b) => b.depth - a.depth); // Deepest first
    
    for (const { id, node } of nodesWithDepth) {
      if (!this.findNodeById(id)) continue; // Already removed
      
      removedIds.push(id);
      
      // If it's a root
      const rootIdx = this.roots.indexOf(node);
      if (rootIdx >= 0) {
        // Move children to become roots
        for (const child of node.children) {
          child.parent = null;
          this.roots.push(child);
        }
        this.roots.splice(rootIdx, 1);
      } else if (node.parent) {
        // Move children to parent
        const parent = node.parent;
        const childIdx = parent.children.indexOf(node);
        
        // Insert node's children at node's position in parent
        parent.children.splice(childIdx, 1, ...node.children);
        
        // Update parent references
        for (const child of node.children) {
          child.parent = parent;
        }
      }
      
      // Update current node if needed
      if (this.currentNode?.id === id) {
        this.currentNode = node.parent || (this.roots.length > 0 ? this.roots[0] : null);
      }
      
      this.nodeCount--;
    }
    
    return removedIds;
  }

  /**
   * Find node by ID across all roots.
   */
  findNodeById(id) {
    for (const root of this.roots) {
      const found = this._findById(root, id);
      if (found) return found;
    }
    return null;
  }

  /**
   * Alias for findNodeById.
   */
  findById(id) {
    return this.findNodeById(id);
  }

  /**
   * Find node by ID recursively within a subtree.
   */
  _findById(node, id) {
    if (!node) return null;
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = this._findById(child, id);
      if (found) return found;
    }
    return null;
  }

  /**
   * Find node by URL (returns first match across all roots).
   */
  findByUrl(url) {
    for (const root of this.roots) {
      const found = this._findByUrlRecursive(root, url);
      if (found) return found;
    }
    return null;
  }

  /**
   * Find node by URL in a specific root.
   * @param {TreeNode} root - The root node to search in
   * @param {string} url - URL to find
   * @returns {TreeNode|null}
   */
  findByUrlInRoot(root, url) {
    if (!root) return null;
    return this._findByUrlRecursive(root, url);
  }

  /**
   * Find the root node that contains the given node.
   * @param {number} nodeId - Node ID to find
   * @returns {TreeNode|null}
   */
  findRootForNode(nodeId) {
    for (const root of this.roots) {
      const found = this._findById(root, nodeId);
      if (found) return root;
    }
    return null;
  }

  _findByUrlRecursive(node, url) {
    if (!node) return null;
    if (node.url === url) return node;
    for (const child of node.children) {
      const found = this._findByUrlRecursive(child, url);
      if (found) return found;
    }
    return null;
  }

  /**
   * Get path from root to current node.
   */
  getPathToCurrent() {
    const path = [];
    let node = this.currentNode;
    while (node) {
      path.unshift(node);
      node = node.parent;
    }
    return path;
  }

  /**
   * Enforce capacity by removing oldest leaf branches.
   */
  _enforceCapacity() {
    while (this.nodeCount > this.capacity) {
      const oldestLeaf = this._findOldestLeaf();
      if (oldestLeaf && oldestLeaf !== this.currentNode) {
        this._removeNodeInternal(oldestLeaf);
        this.nodeCount--;
      } else {
        break;
      }
    }
  }

  /**
   * Find the oldest leaf node across all roots.
   */
  _findOldestLeaf() {
    let oldest = null;
    let oldestTime = Infinity;

    const findLeaves = (n) => {
      if (n.children.length === 0) {
        if (n.timestamp < oldestTime && n !== this.currentNode) {
          oldest = n;
          oldestTime = n.timestamp;
        }
      } else {
        for (const child of n.children) {
          findLeaves(child);
        }
      }
    };

    for (const root of this.roots) {
      findLeaves(root);
    }
    return oldest;
  }

  /**
   * Remove a node internally (for capacity enforcement).
   */
  _removeNodeInternal(node) {
    if (!node.parent) {
      // It's a root
      const idx = this.roots.indexOf(node);
      if (idx !== -1) {
        if (node.children.length > 0) {
          // Promote first child to root
          const newRoot = node.children[0];
          newRoot.parent = null;
          for (let i = 1; i < node.children.length; i++) {
            node.children[i].parent = newRoot;
            newRoot.children.push(node.children[i]);
          }
          this.roots[idx] = newRoot;
        } else {
          this.roots.splice(idx, 1);
        }
      }
    } else {
      const idx = node.parent.children.indexOf(node);
      if (idx !== -1) {
        node.parent.children.splice(idx, 1);
      }
    }
  }

  /**
   * Remove a node by ID from the tree.
   * Reparents children to the node's parent.
   */
  removeNode(nodeId) {
    const node = this.findNodeById(nodeId);
    if (!node) return false;
    
    if (!node.parent) {
      // It's a root
      const idx = this.roots.indexOf(node);
      if (idx !== -1) {
        if (node.children.length === 0) {
          this.roots.splice(idx, 1);
          if (this.currentNode === node) {
            this.currentNode = this.roots[0] || null;
          }
        } else {
          const newRoot = node.children[0];
          newRoot.parent = null;
          for (let i = 1; i < node.children.length; i++) {
            node.children[i].parent = newRoot;
            newRoot.children.push(node.children[i]);
          }
          this.roots[idx] = newRoot;
          if (this.currentNode === node) {
            this.currentNode = newRoot;
          }
        }
        this.nodeCount--;
        return true;
      }
      return false;
    }
    
    // Reparent children to the removed node's parent
    const parent = node.parent;
    const idx = parent.children.indexOf(node);
    
    if (idx !== -1) {
      parent.children.splice(idx, 1);
      for (let i = 0; i < node.children.length; i++) {
        node.children[i].parent = parent;
        parent.children.splice(idx + i, 0, node.children[i]);
      }
    }
    
    if (this.currentNode === node) {
      this.currentNode = parent;
    }
    
    this.nodeCount--;
    return true;
  }

  /**
   * Set capacity.
   */
  setCapacity(capacity) {
    this.capacity = capacity;
    this._enforceCapacity();
  }

  /**
   * Get total node count.
   */
  size() {
    return this.nodeCount;
  }

  /**
   * Clear the tree.
   */
  clear() {
    this.roots = [];
    this.currentNode = null;
    this.nodeCount = 0;
  }

  /**
   * Count nodes in a subtree.
   */
  _countNodes(node) {
    if (!node) return 0;
    let count = 1;
    for (const child of node.children) {
      count += this._countNodes(child);
    }
    return count;
  }

  toJSON() {
    return {
      roots: this.roots.map(r => r.toJSON()),
      // Keep 'root' for backwards compatibility
      root: this.roots[0]?.toJSON() || null,
      currentNodeId: this.currentNode?.id || null,
      capacity: this.capacity,
      nodeCount: this.nodeCount
    };
  }

  /**
   * Create a deep clone of this tree.
   * Used for immutable operations where mutations should not affect the original.
   * @returns {NavigationTree} - A new tree with the same state
   */
  clone() {
    return NavigationTree.fromJSON(this.toJSON());
  }

  /**
   * Create a frozen (immutable) snapshot of this tree.
   * The snapshot can be used for rendering without risk of mutation.
   * @returns {object} - Frozen JSON representation of the tree
   */
  toImmutableSnapshot() {
    const snapshot = this.toJSON();
    
    // Deep freeze the snapshot to prevent any mutations
    const deepFreeze = (obj) => {
      if (obj === null || typeof obj !== 'object') return obj;
      Object.freeze(obj);
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          deepFreeze(obj[key]);
        }
      });
      return obj;
    };
    
    return deepFreeze(snapshot);
  }

  static fromJSON(json) {
    const tree = new NavigationTree(json.capacity || 100);
    
    // Support both new 'roots' array and old 'root' single object
    if (json.roots && json.roots.length > 0) {
      tree.roots = json.roots.map(r => TreeNode.fromJSON(r));
    } else if (json.root) {
      tree.roots = [TreeNode.fromJSON(json.root)];
    }
    
    tree.nodeCount = json.nodeCount || tree.roots.reduce((sum, r) => sum + tree._countNodes(r), 0);
    
    if (json.currentNodeId) {
      tree.currentNode = tree.findNodeById(json.currentNodeId);
    }
    if (!tree.currentNode && tree.roots.length > 0) {
      tree.currentNode = tree.roots[0];
    }
    
    return tree;
  }
}
