/**
 * Tree data structure for browser history tracking.
 * Supports multiple roots (forest) - each new tab creates a new tree.
 * Each node represents a page, children represent pages navigated from that page.
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
      children: this.children.map(c => c.toJSON())
    };
  }

  static fromJSON(json, parent = null) {
    const node = new TreeNode({
      url: json.url,
      title: json.title,
      favicon: json.favicon,
      timestamp: json.timestamp
    });
    node.id = json.id;
    node.collapsed = json.collapsed || false;
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
   */
  navigate(entry) {
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

    // Create new node
    if (this.currentNode) {
      // Add as child of current node (creates branch)
      const newNode = this.currentNode.addChild(entry);
      this.currentNode = newNode;
      this.nodeCount++;
    } else {
      // No current node - create as new root
      const newRoot = new TreeNode(entry);
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
    const newRoot = new TreeNode(entry);
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
