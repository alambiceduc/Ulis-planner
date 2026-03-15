let originalStyles = {
  root: { zoom: '', transform: '' }
};

export function applyPrintAutoFit() {
  const a4Content = document.getElementById('a4-content') || document.querySelector('.a4-content') as HTMLElement;
  const root = document.getElementById('print-fit-root');

  if (!a4Content || !root) {
    console.warn('⚠️ Required elements not found, skipping auto-fit', {
      a4Content: !!a4Content,
      root: !!root
    });
    return;
  }

  const table = root.querySelector('.print-table') as HTMLElement;

  if (!table) {
    console.warn('⚠️ .print-table not found');
    return;
  }

  originalStyles = {
    root: {
      zoom: root.style.zoom,
      transform: root.style.transform
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const availableHeight = a4Content.clientHeight;

      root.style.zoom = '1';
      root.style.transform = 'none';

      void table.offsetHeight;

      console.log('📏 Measuring content with body.printing styles active...');

      const header = root.querySelector('.print-header-compact') as HTMLElement;
      const headerHeight = header?.getBoundingClientRect().height || 0;

      const tbody = table.querySelector('tbody') as HTMLElement;
      const tbodyHeightRect = tbody?.getBoundingClientRect().height || 0;
      const tbodyHeightScroll = tbody?.scrollHeight || 0;
      const tbodyHeight = Math.max(tbodyHeightRect, tbodyHeightScroll);

      const SAFETY_MARGIN = 16;
      const contentHeight = headerHeight + tbodyHeight + SAFETY_MARGIN;

      console.log('=== MEASUREMENT RESULTS (REAL TBODY HEIGHT) ===');
      console.log('📦 Available height (a4-content):', availableHeight.toFixed(2) + 'px');
      console.log('📦 Header height:', headerHeight.toFixed(2) + 'px');
      console.log('📦 Tbody height (rect):', tbodyHeightRect.toFixed(2) + 'px');
      console.log('📦 Tbody height (scroll):', tbodyHeightScroll.toFixed(2) + 'px');
      console.log('📦 Tbody height (used):', tbodyHeight.toFixed(2) + 'px');
      console.log('📦 Total content height:', contentHeight.toFixed(2) + 'px');

      const firstRow = tbody?.querySelector('tr') as HTMLElement;
      const rowHeight = firstRow?.offsetHeight || 0;
      const computedStyle = window.getComputedStyle(root);
      const currentFontSize = parseFloat(computedStyle.fontSize) || 0;

      if (contentHeight === 0 || tbodyHeight === 0) {
        console.warn('⚠️ Content height is zero, skipping scale');
        return;
      }

      const MIN_SCALE = 0.62;
      const MAX_SCALE = 1;

      let scale = (availableHeight / contentHeight) * 0.98;
      scale = Math.max(scale, MIN_SCALE);
      scale = Math.min(scale, MAX_SCALE);

      const scaledHeight = contentHeight * scale;
      const heightUsagePercent = (scaledHeight / availableHeight) * 100;

      console.log('📐 Scale calculation:', {
        rawScale: ((availableHeight / contentHeight) * 0.98).toFixed(4),
        scaleFinal: scale.toFixed(4),
        flooredToMinScale: scale === MIN_SCALE ? 'YES' : 'NO',
        heightUsage: heightUsagePercent.toFixed(1) + '%'
      });

      console.log('DEBUG_PRINT_FIT', {
        contentH_before: contentHeight,
        contentH_after: contentHeight * scale,
        rowHeight: rowHeight,
        fontSize: currentFontSize,
        scaleUsed: scale
      });

      const isChromiumBased = 'chrome' in window;

      if (isChromiumBased) {
        console.log('✅ Applying zoom:', scale);
        root.style.zoom = String(scale);
        root.style.transform = 'none';
      } else {
        console.log('✅ Applying transform scale:', scale);
        root.style.zoom = '';
        root.style.transform = `scale(${scale})`;
        root.style.transformOrigin = 'top left';
      }

      updateDebugDisplay(scale, contentHeight, availableHeight);
    });
  });
}

export function resetPrintAutoFit() {
  const root = document.getElementById('print-fit-root');

  console.log('🔄 Resetting print styles...');

  if (root) {
    root.style.zoom = originalStyles.root.zoom;
    root.style.transform = originalStyles.root.transform;
  }

  console.log('✅ Auto-fit reset complete');
  updateDebugDisplay(1, 0, 0);
}

function updateDebugDisplay(scale: number, contentH: number, availableH: number) {
  const debugEl = document.getElementById('zoom-debug');
  if (debugEl) {
    debugEl.textContent = `Scale: ${scale.toFixed(3)} | Content: ${contentH.toFixed(0)}px | Available: ${availableH.toFixed(0)}px`;
  }
}
