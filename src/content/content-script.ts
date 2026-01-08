/**
 * Content script for Trail.
 * In single-tab mode: intercepts target="_blank" links to open in same tab.
 * In multi-tab mode: lets links open naturally in new tabs.
 */

import { Title, Url } from "../shared/types/ids";
import { notifyTitleChange } from "../sidepanel/api/chrome";

(function() {
  'use strict';

  // todo: perhaps intercept redirects inside the same tab
  /**
   * Track title changes (for pages like YouTube that update title dynamically).
   * Uses MutationObserver to watch the <title> element.
   */
  let lastTitle = document.title;
  
  
  // Observe title element changes
  const titleElement = document.querySelector('title');
  if (titleElement) {
    const titleObserver = new MutationObserver(() => {
      const newTitle = document.title as Title;
      if (newTitle && newTitle !== lastTitle) {
        lastTitle = newTitle;
        notifyTitleChange(window.location.href as Url, newTitle);
      }
    });
    
    titleObserver.observe(titleElement, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }
  
  // Also check periodically for pages that set title via JS
  // without modifying the <title> element directly
  let titleCheckInterval = setInterval(() => {
    const newTitle = document.title as Title;
    if (newTitle && newTitle !== lastTitle) {
      lastTitle = newTitle;
      notifyTitleChange(window.location.href as Url, newTitle);
    }
  }, 2000);
  
  // Stop checking after 30 seconds (most pages have stable titles by then)
  setTimeout(() => {
    clearInterval(titleCheckInterval);
  }, 30000);

  console.debug('trail content script loaded');
})();
