/**
 * Tree data structure for browser history tracking.
 * Each node represents a page, children represent pages navigated from that page.
 * When navigating from an old page to a new one, creates a new branch.
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
    this.root = null;
    this.currentNode = null;
    this.capacity = capacity;
    this.nodeCount = 0;
  }

  /**
   * Navigate to a new page from the current node.
   * Creates a new child node under currentNode.
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
    if (!this.root) {
      // First navigation - create root
      this.root = new TreeNode(entry);
      this.currentNode = this.root;
      this.nodeCount = 1;
    } else if (this.currentNode) {
      // Add as child of current node (creates branch)
      const newNode = this.currentNode.addChild(entry);
      this.currentNode = newNode;
      this.nodeCount++;
    } else {
      // No current node but have root - shouldn't happen, but handle it
      this.root = new TreeNode(entry);
      this.currentNode = this.root;
      this.nodeCount = 1;
    }

    // Enforce capacity by pruning oldest branches
    this._enforceCapacity();

    return this.currentNode;
  }

  /**
   * Set the current node by ID (for clicking in sidebar).
   */
  setCurrentById(nodeId) {
    const node = this._findById(this.root, nodeId);
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
    const node = this._findById(this.root, nodeId);
    if (node) {
      node.collapsed = !node.collapsed;
      return true;
    }
    return false;
  }

  /**
   * Find node by ID recursively.
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
   * Find node by URL (returns first match).
   */
  findByUrl(url) {
    return this._findByUrlRecursive(this.root, url);
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
      const oldestLeaf = this._findOldestLeaf(this.root);
      if (oldestLeaf && oldestLeaf !== this.root && oldestLeaf !== this.currentNode) {
        this._removeNode(oldestLeaf);
        this.nodeCount--;
      } else {
        break; // Can't remove any more
      }
    }
  }

  /**
   * Find the oldest leaf node (node with no children).
   */
  _findOldestLeaf(node) {
    if (!node) return null;
    
    let oldest = null;
    let oldestTime = Infinity;

    const findLeaves = (n) => {
      if (n.children.length === 0) {
        // It's a leaf
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

    findLeaves(node);
    return oldest;
  }

  /**
   * Remove a node from its parent.
   */
  _removeNode(node) {
    if (!node.parent) return;
    const idx = node.parent.children.indexOf(node);
    if (idx !== -1) {
      node.parent.children.splice(idx, 1);
    }
  }

  /**
   * Remove a node by ID from the tree.
   * Reparents children to the node's parent.
   * @param {number} nodeId - ID of the node to remove
   * @returns {boolean} - Whether the node was found and removed
   */
  removeNode(nodeId) {
    const node = this._findById(this.root, nodeId);
    if (!node) return false;
    
    // Can't remove root if it's the only node
    if (node === this.root) {
      if (node.children.length === 0) {
        // Remove entire tree
        this.root = null;
        this.currentNode = null;
        this.nodeCount = 0;
        return true;
      }
      // Make first child the new root
      const newRoot = node.children[0];
      newRoot.parent = null;
      // Reparent other children to new root
      for (let i = 1; i < node.children.length; i++) {
        node.children[i].parent = newRoot;
        newRoot.children.push(node.children[i]);
      }
      this.root = newRoot;
      if (this.currentNode === node) {
        this.currentNode = newRoot;
      }
      this.nodeCount--;
      return true;
    }
    
    // Reparent children to the removed node's parent
    const parent = node.parent;
    const idx = parent.children.indexOf(node);
    
    if (idx !== -1) {
      // Remove the node
      parent.children.splice(idx, 1);
      
      // Add its children to parent at the same position
      for (let i = 0; i < node.children.length; i++) {
        node.children[i].parent = parent;
        parent.children.splice(idx + i, 0, node.children[i]);
      }
    }
    
    // Update current node if needed
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
    this.root = null;
    this.currentNode = null;
    this.nodeCount = 0;
  }

  /**
   * Count nodes recursively.
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
      root: this.root ? this.root.toJSON() : null,
      currentNodeId: this.currentNode?.id || null,
      capacity: this.capacity,
      nodeCount: this.nodeCount
    };
  }

  static fromJSON(json) {
    const tree = new NavigationTree(json.capacity || 100);
    if (json.root) {
      tree.root = TreeNode.fromJSON(json.root);
      tree.nodeCount = json.nodeCount || tree._countNodes(tree.root);
      if (json.currentNodeId) {
        tree.currentNode = tree._findById(tree.root, json.currentNodeId);
      }
      if (!tree.currentNode) {
        tree.currentNode = tree.root;
      }
    }
    return tree;
  }
}
