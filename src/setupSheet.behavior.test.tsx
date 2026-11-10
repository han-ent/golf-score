// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDefaultScorecardRound } from './domain/scorecard';
import { RoundSetupSheet } from './RoundSetupSheet';
import { roundSetupDraftFromRound, type RoundSetupDraft } from './roundSetup';
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
});

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
