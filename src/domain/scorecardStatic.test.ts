import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';

import { App } from '../App';

const forbiddenRuntimeConcepts = ['오장', '정산', '타당 금액', '배판', '니어', 'QR', '공유 링크', 'GPS', '날씨', '캐디 추천', '클럽 거리'];

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function runtimeSourceFiles(directory: string): readonly string[] {
  return readdirSync(join(process.cwd(), directory)).flatMap((entry) => {
    const path = `${directory}/${entry}`;
    const absolutePath = join(process.cwd(), path);
    if (statSync(absolutePath).isDirectory()) {
      return runtimeSourceFiles(path);
    }
    if (!/\.(ts|tsx|css)$/.test(path) || /\.test\.tsx?$/.test(path) || path.endsWith('vitest-node.d.ts')) {
      return [];
    }
    return [path];
  });
}

describe('simple scorecard static guardrails', () => {
  it('SSR renders the Korean scorecard concepts without browser globals', () => {
    const html = renderToString(React.createElement(App));

    expect(html).toContain('골프 스코어');
    expect(html).toContain('Enjoy!');
    expect(html).not.toContain('FunGolf');
    expect(readRepoFile('src/App.tsx')).toContain('이 기기에 저장됨');
    expect(html).toContain('다음 홀');
    expect(html).toContain('스코어카드');
    expect(html).toContain('홀 메모');
    expect(html).toContain('온');
    expect(html).toContain('펏');
    expect(html).toContain('라운드 리뷰');
    expect(html).toContain('스코어카드 내보내기');
    expect(html).toContain('카카오톡 등으로 내보냅니다');
    expect(html).not.toContain('스코어카드 PNG 저장');
  });

  it('index metadata describes the simple scorecard product', () => {
    const indexHtml = readRepoFile('index.html');
    expect(indexHtml).toContain('<title>골프 스코어</title>');
    expect(indexHtml).not.toContain('FunGolf');
    expect(indexHtml).toContain('온·펏');
    expect(indexHtml).toContain('manifest.webmanifest');
    expect(indexHtml).not.toContain('오장');
    expect(indexHtml).not.toContain('정산');
  });

  it('runtime source and public docs keep retired concepts out', () => {
    const sources = ['README.md', 'DESIGN.md', 'index.html', ...runtimeSourceFiles('src')].map(readRepoFile).join('\n');

    for (const forbidden of forbiddenRuntimeConcepts) {
      expect(sources).not.toContain(forbidden);
    }
  });

  it('scrolls a few wide scorecard cells and keeps on-putt text readable', () => {
    const scorecardCss = readRepoFile('src/scorecard.css');

    expect(scorecardCss).toContain('overflow-x: auto');
    expect(scorecardCss).toContain('minmax(56px, 72px)');
    expect(scorecardCss).toContain('min-width: 56px');
    expect(scorecardCss).toContain('font-size: 12px');
    expect(scorecardCss).toContain('color: #141414');
    expect(scorecardCss).toContain('width: max-content');
    expect(scorecardCss).toContain('min-width: 0');
    expect(readRepoFile('src/styles.css')).toContain('--vv-height');
    expect(readRepoFile('src/styles.css')).toContain('100dvh');
  });

  it('places a brass Enjoy accent 8px to the right of the header title', () => {
    const styles = readRepoFile('src/styles.css');
    const app = readRepoFile('src/App.tsx');
    const product = styles.match(/\.product \{[^}]+\}/)?.[0] ?? '';
    const enjoy = styles.match(/\.product-enjoy \{[^}]+\}/)?.[0] ?? '';

    expect(app).toContain('className="product-name">골프 스코어');
    expect(app).toContain('className="product-enjoy">Enjoy!');
    expect(product).toContain('gap: var(--space-2)');
    expect(enjoy).toContain('color: var(--brass)');
    expect(enjoy).toContain('font-size: 12px');
  });

  it('keeps layout spacing on the 4/8/12/16/24/32 scale', () => {
    const css = ['src/styles.css', 'src/scorecard.css'].map(readRepoFile).join('\n');
    const declarations = css.match(/(?:^|[{;])\s*(?:margin|padding|gap|row-gap|column-gap)\s*:[^;]+/g) ?? [];
    const rawPixels = declarations.flatMap((declaration) => declaration.match(/\d+px/g) ?? []);
    const allowed = new Set(['0px', '4px', '8px', '12px', '16px', '24px', '32px']);
    expect(rawPixels.filter((value) => !allowed.has(value))).toEqual([]);
  });

  it('keeps the next-hole action and selected player controls explicit', () => {
    const appSource = readRepoFile('src/App.tsx');
    const gridSource = readRepoFile('src/ScorecardGrid.tsx');

    expect(appSource).toContain('다음 홀');
    expect(appSource).toContain('aria-checked');
    expect(appSource).toContain('role="radio"');
    expect(gridSource).toContain('aria-selected');
    expect(gridSource).toContain('role="tab"');
    expect(appSource).not.toContain('로컬 저장');
  });

  it('keeps a visible in-app browser export fallback instead of silent downloads', () => {
    const appSource = readRepoFile('src/App.tsx');
    const styles = readRepoFile('src/styles.css');

    expect(appSource).toContain('이미지를 길게 눌러 저장/공유');
    expect(appSource).toContain('Chrome 또는 Safari');
    expect(styles).toContain('.export-preview');
    expect(styles).toContain('object-fit: contain');
  });

  it('uses the scorecard storage key and does not reference the old ledger key in runtime source', () => {
    const runtime = ['src/domain/scorecardStorage.ts', 'src/useScorecardSession.ts', 'src/App.tsx'].map(readRepoFile).join('\n');
    expect(runtime).toContain('fungolf-scorecard:active-round');
    expect(runtime).not.toContain('golf-bet-ledger');
  });

  it('caches same-origin static files for offline field use', () => {
    const worker = readRepoFile('public/sw.js');
    const manifest = readRepoFile('public/manifest.webmanifest');

    expect(worker).toContain('fungolf-static');
    expect(worker).toContain('self.location.origin');
    expect(worker).not.toContain('https://');
    expect(manifest).toContain('"name": "골프 스코어"');
    expect(manifest).toContain('"short_name": "골프 스코어"');
    expect(manifest).not.toContain('FunGolf');
    expect(manifest).toContain('"start_url": "./"');
  });
});
