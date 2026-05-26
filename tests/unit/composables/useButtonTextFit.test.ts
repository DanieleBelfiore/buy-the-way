import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupButtonTextFit } from '@/composables/useButtonTextFit';

describe('useButtonTextFit', () => {
  let originalRO: typeof globalThis.ResizeObserver;
  let originalMO: typeof globalThis.MutationObserver;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Mock getComputedStyle
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
      return { fontSize: (el as HTMLElement).style.fontSize || '16px' } as CSSStyleDeclaration;
    });

    // Mock requestAnimationFrame
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    // Mock Observers
    originalRO = globalThis.ResizeObserver;
    originalMO = globalThis.MutationObserver;
    
    globalThis.mockROCallback = undefined;
    globalThis.mockMOCallback = undefined;
    
    class MockRO {
      constructor(cb: ResizeObserverCallback) {
        globalThis.mockROCallback = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    
    class MockMO {
      constructor(cb: MutationCallback) {
        globalThis.mockMOCallback = cb;
      }
      observe() {}
      disconnect() {}
    }
    
    globalThis.ResizeObserver = MockRO as unknown as typeof globalThis.ResizeObserver;
    globalThis.MutationObserver = MockMO as unknown as typeof globalThis.MutationObserver;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.ResizeObserver = originalRO;
    globalThis.MutationObserver = originalMO;
  });

  it('reduces font size when text overflows', () => {
    // We create a button that overflows.
    // To mock scrollWidth > clientWidth, we define getters on the elements.
    const btn = document.createElement('button');
    btn.textContent = 'Too long text';
    btn.style.fontSize = '16px';
    
    Object.defineProperty(btn, 'clientWidth', { get: () => 100, configurable: true });
    Object.defineProperty(btn, 'scrollWidth', { 
      get: () => {
        const size = parseFloat(btn.style.fontSize) || 16;
        return size > 15 ? 200 : 100;
      },
      configurable: true
    });
    
    document.body.appendChild(btn);
    
    setupButtonTextFit();
    
    // The requestAnimationFrame will fire immediately due to our mock
    // Initial size is 16. The while loop runs because 200 > 100.
    expect(btn.style.fontSize).toBe('15px');
  });

  it('does not reduce font size when text fits', () => {
    const btn = document.createElement('button');
    btn.textContent = 'Fits';
    btn.style.fontSize = '16px';
    
    Object.defineProperty(btn, 'clientWidth', { get: () => 100 });
    Object.defineProperty(btn, 'scrollWidth', { get: () => 50 });
    
    document.body.appendChild(btn);
    setupButtonTextFit();
    
    expect(btn.style.fontSize).toBe('16px');
  });
  
  it('stops at minSize even if it still overflows', () => {
    const btn = document.createElement('button');
    btn.textContent = 'Way too long text';
    btn.style.fontSize = '16px';
    
    Object.defineProperty(btn, 'clientWidth', { get: () => 100, configurable: true });
    // Always overflows
    Object.defineProperty(btn, 'scrollWidth', { get: () => 200, configurable: true });
    
    document.body.appendChild(btn);
    setupButtonTextFit();
    
    // Will drop by 0.5 until it hits 9px (minSize)
    expect(btn.style.fontSize).toBe('9px');
  });

  it('also measures inner spans', () => {
    const btn = document.createElement('button');
    const span = document.createElement('span');
    span.textContent = 'Inner overflow';
    span.style.fontSize = '16px';
    btn.appendChild(span);
    
    Object.defineProperty(btn, 'clientWidth', { get: () => 100, configurable: true });
    Object.defineProperty(btn, 'scrollWidth', { get: () => 50, configurable: true });
    
    Object.defineProperty(span, 'clientWidth', { get: () => 100, configurable: true });
    Object.defineProperty(span, 'scrollWidth', { 
      get: () => {
        const size = parseFloat(span.style.fontSize) || 16;
        return size > 15 ? 200 : 100;
      },
      configurable: true
    });
    
    document.body.appendChild(btn);
    setupButtonTextFit();
    
    // Span should have its font size reduced
    expect(span.style.fontSize).toBe('15px');
  });

  it('handles ResizeObserver triggers', () => {
    setupButtonTextFit();
    const btn = document.createElement('button');
    btn.textContent = 'RO test';
    btn.style.fontSize = '16px';
    const span = document.createElement('span');
    span.textContent = 'RO span';
    btn.appendChild(span);
    
    Object.defineProperty(btn, 'clientWidth', { get: () => 100, configurable: true });
    Object.defineProperty(btn, 'scrollWidth', { 
      get: () => {
        const size = parseFloat(btn.style.fontSize) || 16;
        return size > 15 ? 200 : 100;
      },
      configurable: true
    });
    
    document.body.appendChild(btn);
    
    if (globalThis.mockROCallback) {
      globalThis.mockROCallback([
        { target: btn } as unknown as ResizeObserverEntry,
        { target: span } as unknown as ResizeObserverEntry
      ], {} as ResizeObserver);
    }
    
    expect(btn.style.fontSize).toBe('15px');
  });

  it('handles MutationObserver triggers', () => {
    setupButtonTextFit();
    const btn = document.createElement('button');
    btn.textContent = 'MO test';
    btn.style.fontSize = '16px';
    const span = document.createElement('span');
    span.textContent = 'MO span';
    btn.appendChild(span);
    
    Object.defineProperty(btn, 'clientWidth', { get: () => 100, configurable: true });
    Object.defineProperty(btn, 'scrollWidth', { 
      get: () => {
        const size = parseFloat(btn.style.fontSize) || 16;
        return size > 15 ? 200 : 100;
      },
      configurable: true
    });
    
    document.body.appendChild(btn);
    
    if (globalThis.mockMOCallback) {
      globalThis.mockMOCallback([{ type: 'childList' } as MutationRecord], {} as MutationObserver);
    }
    
    expect(btn.style.fontSize).toBe('15px');
  });
});
