// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDefaultScorecardRound } from './domain/scorecard';
import { RoundSetupSheet } from './RoundSetupSheet';
import { roundSetupDraftFromRound, type RoundSetupDraft } from './roundSetup';
import { scrollDeltaToClearFooter, viewportIsKeyboardOccluded } from './sheetKeyboard';
import { useViewportSheet } from './useViewportSheet';

type ViewportStub = {
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
  dispatch: (type: string) => void;
};

let viewport: ViewportStub;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const listeners = new Map<string, Set<() => void>>();
  viewport = {
    width: 390,
    height: 700,
    offsetTop: 0,
    offsetLeft: 0,
    addEventListener(type, listener) {
      const group = listeners.get(type) ?? new Set();
      group.add(listener);
      listeners.set(type, group);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type) {
      for (const listener of listeners.get(type) ?? []) listener();
    },
  };
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  HTMLElement.prototype.scrollIntoView = () => undefined;
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('round setup typing', () => {
  it('keeps typed english in order and the same input node when the dirty warning appears', async () => {
    const view = await renderSheet();
    const input = field('courseName');
    typeText(input, 'abc');
    await act(async () => undefined);
    expect(input.value).toBe('abc');
    expect(field('courseName')).toBe(input);
    expect(document.body.textContent).toContain('저장하지 않은 변경이 있습니다');
    view.unmount();
  });

  it('commits a Korean composition as 한영석 without rewriting the field', async () => {
    const view = await renderSheet();
    const input = field('name-0');
    input.focus();
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    for (const value of ['ㅎ', '하', '한', '한ㅇ', '한여', '한영', '한영ㅅ', '한영서', '한영석']) {
      input.value = value;
      input.setSelectionRange(value.length, value.length);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, isComposing: true, inputType: 'insertCompositionText' }));
      input.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: value }));
      await act(async () => undefined);
      expect(input.value).toBe(value);
      expect(field('name-0')).toBe(input);
    }
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '한영석' }));
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: '한영석', inputType: 'insertCompositionText' }));
    await act(async () => undefined);
    expect(input.value).toBe('한영석');
    expect(field('name-0')).toBe(input);
    expect(document.body.textContent).toContain('저장하지 않은 변경이 있습니다');
    view.unmount();
  });

  it('keeps the focused input mounted and its value when the keyboard shrinks the viewport', async () => {
    const view = await renderSheet();
    const input = field('courseName');
    typeText(input, 'abc');
    await act(async () => undefined);
    input.focus();
    const sheet = document.querySelector('.sheet');
    if (!(sheet instanceof HTMLElement)) throw new Error('missing sheet');
    sheet.scrollTop = 40;
    viewport.height = 320;
    act(() => viewport.dispatch('resize'));
    expect(field('courseName')).toBe(input);
    expect(input.value).toBe('abc');
    expect(document.documentElement.style.getPropertyValue('--vv-height')).toBe('320px');
    expect(sheet.scrollTop).toBe(40);
    view.unmount();
  });

  it('keeps the focused setup field above the collapsed footer when the keyboard covers the sheet', async () => {
    expect(viewportIsKeyboardOccluded(844, 420)).toBe(true);
    expect(viewportIsKeyboardOccluded(844, 780)).toBe(false);
    expect(scrollDeltaToClearFooter({ top: 300, bottom: 380 }, 56, 336)).toBe(44);

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    viewport.width = 390;
    viewport.height = 420;
    const view = await renderSheet();
    const sheet = document.querySelector('.sheet');
    if (!(sheet instanceof HTMLElement)) throw new Error('missing sheet');
    const layout = installKeyboardLayout(sheet);

    try {
      await act(async () => {
        [...document.querySelectorAll('button')].find((button) => button.textContent === '4명')?.click();
      });
      for (const name of ['roundName', 'holeCount', 'name-3']) {
        const input = field(name);
        await act(async () => {
          input.focus();
          viewport.dispatch('resize');
        });
        const label = input.closest('label');
        const footer = document.querySelector('.sheet-actions');
        const header = document.querySelector('.sheet-header');
        if (!(label instanceof HTMLElement) || !(footer instanceof HTMLElement) || !(header instanceof HTMLElement)) throw new Error('missing field');
        const fieldBox = label.getBoundingClientRect();
        const footerBox = footer.getBoundingClientRect();
        const headerBox = header.getBoundingClientRect();
        expect(sheet.classList.contains('keyboard-open')).toBe(true);
        expect(document.querySelector('.sheet-actions .save-state')).toBeNull();
        expect(document.body.textContent).not.toContain('새 라운드');
        expect(document.body.textContent).not.toContain('저장 안 함');
        expect(document.body.textContent).toContain('저장');
        expect(sheet.style.scrollPaddingTop).toBe(sheet.style.getPropertyValue('--sheet-header'));
        expect(sheet.style.scrollPaddingBottom).toBe(sheet.style.getPropertyValue('--sheet-footer'));
        expect(fieldBox.height).toBeGreaterThan(0);
        expect(fieldBox.top).toBeGreaterThanOrEqual(0);
        expect(fieldBox.bottom).toBeLessThanOrEqual(viewport.height);
        expect(fieldBox.top).toBeGreaterThanOrEqual(headerBox.bottom);
        expect(fieldBox.bottom).toBeLessThanOrEqual(footerBox.top);
        expect(fieldBox.left).toBeGreaterThanOrEqual(0);
        expect(fieldBox.right).toBeLessThanOrEqual(390);
        expect(intersects(fieldBox, footerBox)).toBe(false);
        expect(intersects(fieldBox, headerBox)).toBe(false);
        expect(sheet.style.scrollPaddingTop).toBe(sheet.style.getPropertyValue('--sheet-header'));
        if (name === 'roundName') expect(label.textContent).toContain('라운드 이름');
      }
      viewport.height = 844;
      await act(async () => {
        field('name-3').focus();
        viewport.dispatch('resize');
      });
      const closedLabel = field('name-3').closest('label');
      const closedFooter = document.querySelector('.sheet-actions');
      const closedHeader = document.querySelector('.sheet-header');
      if (!(closedLabel instanceof HTMLElement) || !(closedFooter instanceof HTMLElement) || !(closedHeader instanceof HTMLElement)) throw new Error('missing closed field');
      const closedField = closedLabel.getBoundingClientRect();
      const closedFooterBox = closedFooter.getBoundingClientRect();
      const closedHeaderBox = closedHeader.getBoundingClientRect();
      expect(closedField.top).toBeGreaterThanOrEqual(closedHeaderBox.bottom);
      expect(closedField.bottom).toBeLessThanOrEqual(closedFooterBox.top);
      expect(intersects(closedField, closedFooterBox)).toBe(false);
      expect(intersects(closedField, closedHeaderBox)).toBe(false);
      expect(sheet.classList.contains('keyboard-open')).toBe(false);
      expect(document.body.textContent).toContain('새 라운드');
      expect(document.body.textContent).toContain('저장하지 않은 변경이 있습니다');
    } finally {
      layout.restore();
    }
    view.unmount();
  });
});

function intersects(field: DOMRect, footer: DOMRect): boolean {
  return field.top < footer.bottom && field.bottom > footer.top && field.left < footer.right && field.right > footer.left;
}

function installKeyboardLayout(sheet: HTMLElement): { restore: () => void } {
  let scroll = 0;
  const body = sheet.querySelector('.sheet-body');
  if (!(body instanceof HTMLElement)) throw new Error('missing body');
  const originalRect = HTMLElement.prototype.getBoundingClientRect;
  const originalDescriptor = Object.getOwnPropertyDescriptor(body, 'scrollTop') ?? Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTop');
  Object.defineProperty(body, 'scrollTop', {
    configurable: true,
    get: () => scroll,
    set: (value: number) => {
      scroll = value;
    },
  });
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this === sheet) return rect(0, 8, 390, 400);
    if (this.classList.contains('sheet-body')) return rect(0, 64, 390, 284);
    if (this.classList.contains('sheet-actions')) return rect(0, 348, 390, 56);
    if (this.classList.contains('sheet-header')) return rect(0, 8, 390, 56);
    if (this.tagName === 'LABEL') {
      const input = this.querySelector('input');
      const name = input?.getAttribute('name');
      const natural = name === 'roundName' ? 300 : name === 'holeCount' ? 460 : name === 'name-3' ? 900 : 180;
      return rect(0, natural - scroll, 390, 72);
    }
    return rect(0, 0, 0, 0);
  };
  return {
    restore: () => {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
      if (originalDescriptor) Object.defineProperty(body, 'scrollTop', originalDescriptor);
    },
  };
}

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    toJSON() { return this; },
  } as DOMRect;
}

function field(name: string): HTMLInputElement {
  const input = document.querySelector(`input[name="${name}"]`);
  if (!(input instanceof HTMLInputElement)) throw new Error(`missing ${name}`);
  return input;
}

function typeText(input: HTMLInputElement, value: string) {
  const prototype = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  for (const char of Array.from(value)) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const next = `${input.value.slice(0, start)}${char}${input.value.slice(end)}`;
    act(() => {
      prototype?.set?.call(input, next);
      input.setSelectionRange(start + char.length, start + char.length);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: char, inputType: 'insertText' }));
    });
  }
}

async function renderSheet(): Promise<Root> {
  const root = document.createElement('div');
  document.body.append(root);
  const view = createRoot(root);
  await act(async () => {
    view.render(<SheetHarness />);
  });
  return view;
}

function SheetHarness() {
  const round = createDefaultScorecardRound({ now: '2026-11-10T00:00:00.000Z' });
  const [draft, setDraft] = useState<RoundSetupDraft>(() => roundSetupDraftFromRound(round));
  useViewportSheet(true);
  return (
    <RoundSetupSheet
      round={round}
      draft={draft}
      onDraft={setDraft}
      onSave={() => undefined}
      onClose={() => undefined}
      onNewRound={() => undefined}
    />
  );
}
