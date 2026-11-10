export const keyboardOcclusionThreshold = 120;

export function viewportIsKeyboardOccluded(windowHeight: number, viewportHeight: number): boolean {
  return windowHeight - viewportHeight >= keyboardOcclusionThreshold;
}

export function scrollDeltaToClearFooter(
  field: { readonly top: number; readonly bottom: number },
  headerBottom: number,
  footerTop: number,
): number {
  if (field.bottom > footerTop) return field.bottom - footerTop;
  if (field.top < headerBottom) return field.top - headerBottom;
  return 0;
}

export function placeFieldAboveFooter(field: HTMLElement): void {
  const sheet = field.closest('.sheet');
  if (!(sheet instanceof HTMLElement)) return;
  const target = field.closest('label') ?? field;
  const fieldBox = target.getBoundingClientRect();
  if (fieldBox.height <= 0 || fieldBox.width <= 0) return;
  if (sheet.classList.contains('setup-sheet')) {
    const scroller = sheet.querySelector('.sheet-body');
    if (!(scroller instanceof HTMLElement)) return;
    const view = scroller.getBoundingClientRect();
    const delta = scrollDeltaToClearFooter(fieldBox, view.top, view.bottom);
    if (delta === 0) return;
    scroller.scrollTop += delta;
    const again = scrollDeltaToClearFooter(target.getBoundingClientRect(), view.top, view.bottom);
    if (again !== 0) scroller.scrollTop += again;
    return;
  }
  const footer = sheet.querySelector('.sheet-actions');
  const header = sheet.querySelector(':scope > h2, :scope > .history-viewer-bar');
  const sheetBox = sheet.getBoundingClientRect();
  const headerBottom = header instanceof HTMLElement ? header.getBoundingClientRect().bottom : sheetBox.top;
  const footerTop = footer instanceof HTMLElement ? footer.getBoundingClientRect().top : sheetBox.bottom;
  const delta = scrollDeltaToClearFooter(fieldBox, headerBottom, footerTop);
  if (delta === 0) return;
  sheet.scrollTop += delta;
  const again = scrollDeltaToClearFooter(target.getBoundingClientRect(), headerBottom, footerTop);
  if (again !== 0) sheet.scrollTop += again;
}

export function syncSheetFooterHeight(sheet: HTMLElement): void {
  const footer = sheet.querySelector('.sheet-actions');
  const header = sheet.querySelector('.sheet-header');
  const footerHeight = footer instanceof HTMLElement ? Math.ceil(footer.getBoundingClientRect().height) : 0;
  const headerHeight = header instanceof HTMLElement ? Math.ceil(header.getBoundingClientRect().height) : 0;
  const footerSpace = footerHeight > 0 ? `${footerHeight}px` : '0px';
  const headerSpace = headerHeight > 0 ? `${headerHeight}px` : '0px';
  sheet.style.setProperty('--sheet-footer', footerSpace);
  sheet.style.setProperty('--sheet-header', headerSpace);
  sheet.style.scrollPaddingTop = headerSpace;
  sheet.style.scrollPaddingBottom = footerSpace;
  const body = sheet.querySelector('.sheet-body');
  if (body instanceof HTMLElement) {
    body.style.scrollPaddingTop = '8px';
    body.style.scrollPaddingBottom = '8px';
  }
}
