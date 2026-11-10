import { useEffect } from 'react';

import { placeFieldAboveFooter } from './sheetKeyboard';

export function useViewportSheet(open: boolean) {
  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    const place = () => {
      const viewport = window.visualViewport;
      root.style.setProperty('--vv-top', `${viewport?.offsetTop ?? 0}px`);
      root.style.setProperty('--vv-left', `${viewport?.offsetLeft ?? 0}px`);
      root.style.setProperty('--vv-width', `${viewport?.width ?? window.innerWidth}px`);
      root.style.setProperty('--vv-height', `${viewport?.height ?? window.innerHeight}px`);
    };
    const onResize = () => {
      place();
      revealFocusedSheetField();
    };
    const onScroll = () => {
      place();
    };

    place();
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    window.visualViewport?.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('scroll', onScroll);

    return () => {
      window.visualViewport?.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('scroll', onScroll);
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      root.style.removeProperty('--vv-top');
      root.style.removeProperty('--vv-left');
      root.style.removeProperty('--vv-width');
      root.style.removeProperty('--vv-height');
      window.scrollTo(0, scrollY);
    };
  }, [open]);
}

function revealFocusedSheetField() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return;
  if (active.closest('.sheet')) {
    placeFieldAboveFooter(active);
    return;
  }
  if (!active.closest('.confirm-dialog')) return;
  active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
