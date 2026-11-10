export const keyboardOcclusionThreshold = 120;
const fieldClearance = 12;

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
  const footer = sheet.querySelector('.sheet-actions');
  const header = sheet.querySelector(':scope > h2, :scope > .history-viewer-bar');
  const fieldBox = target.getBoundingClientRect();
  if (fieldBox.height <= 0 || fieldBox.width <= 0) return;
  const sheetBox = sheet.getBoundingClientRect();
  const headerBottom = (header instanceof HTMLElement ? header.getBoundingClientRect().bottom : sheetBox.top) + 8;
  const footerTop = (footer instanceof HTMLElement ? footer.getBoundingClientRect().top : sheetBox.bottom) - fieldClearance;
  const delta = scrollDeltaToClearFooter(fieldBox, headerBottom, footerTop);
  if (delta === 0) return;
  sheet.scrollTop += delta;
  const next = target.getBoundingClientRect();
  const again = scrollDeltaToClearFooter(next, headerBottom, footerTop);
  if (again !== 0) sheet.scrollTop += again;
}

export function syncSheetFooterHeight(sheet: HTMLElement, keyboardOpen: boolean): void {
  const footer = sheet.querySelector('.sheet-actions');
  const measured = footer instanceof HTMLElement ? Math.ceil(footer.getBoundingClientRect().height) : 0;
  const footerSpace = measured > 0 ? `${measured + fieldClearance}px` : '0px';
  sheet.style.setProperty('--sheet-footer', footerSpace);
  sheet.style.scrollPaddingTop = '56px';
  sheet.style.scrollPaddingBottom = keyboardOpen ? footerSpace : '0px';
  const body = sheet.querySelector('.sheet-body');
  if (body instanceof HTMLElement) body.style.paddingBottom = keyboardOpen ? footerSpace : '';
}
