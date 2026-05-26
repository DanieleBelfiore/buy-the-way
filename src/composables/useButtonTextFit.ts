export function setupButtonTextFit() {
  const originalFontSizes = new WeakMap<HTMLElement, string>();

  function fitElement(el: HTMLElement) {
    // Save original font size if not already saved
    if (!originalFontSizes.has(el)) {
      originalFontSizes.set(el, window.getComputedStyle(el).fontSize);
    }
    
    // Reset to original font size to measure accurately
    el.style.fontSize = originalFontSizes.get(el)!;
    
    // We use requestAnimationFrame to let the browser apply the reset font size
    // and recalculate layout before measuring.
    requestAnimationFrame(() => {
      // If it fits, we're done
      if (el.scrollWidth <= el.clientWidth) return;
      
      let currentSize = parseFloat(window.getComputedStyle(el).fontSize);
      const minSize = 9; // Minimum readable font size in px
      
      // Reduce font size until it fits or hits the minimum
      while (el.scrollWidth > el.clientWidth && currentSize > minSize) {
        currentSize -= 0.5;
        el.style.fontSize = `${currentSize}px`;
      }
    });
  }

  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target as HTMLElement;
      if (el.tagName === 'SPAN' && el.parentElement?.tagName === 'BUTTON') {
        fitElement(el);
      } else if (el.tagName === 'BUTTON') {
        // Direct text in button
        if (Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) {
          fitElement(el);
        }
        // Sub-spans
        el.querySelectorAll('span').forEach(fitElement);
      }
    }
  });

  const mutationObserver = new MutationObserver((mutations) => {
    let shouldCheck = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        shouldCheck = true;
        break;
      }
    }
    
    if (shouldCheck) {
      document.querySelectorAll('button').forEach(btn => {
        resizeObserver.observe(btn);
        
        if (Array.from(btn.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) {
          fitElement(btn);
        }
        
        btn.querySelectorAll('span').forEach(span => {
          resizeObserver.observe(span);
          fitElement(span);
        });
      });
    }
  });

  // Start observing
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  
  // Initial run
  document.querySelectorAll('button').forEach(btn => {
    resizeObserver.observe(btn);
    if (Array.from(btn.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) {
      fitElement(btn);
    }
    btn.querySelectorAll('span').forEach(span => {
      resizeObserver.observe(span);
      fitElement(span);
    });
  });
}
