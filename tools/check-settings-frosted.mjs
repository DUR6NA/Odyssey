/**
 * Asserts settings surfaces ship frosted-glass styles:
 * translucent background + non-zero backdrop-filter blur.
 * Reads the real public/settings.html + public/style.css entry points.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const cssPath = path.join(root, 'public', 'style.css');
const htmlPath = path.join(root, 'public', 'settings.html');

const MIN_BLUR_PX = 8;
const GLASS_SELECTORS = ['.sidebar', '.settings-main', '.btn-top-right'];

function fail(msg) {
  console.error('FAIL:', msg);
  process.exitCode = 1;
}

function pass(msg) {
  console.log('PASS:', msg);
}

/** Extract all rule bodies for an exact selector (brace-matched). */
function extractAllRuleBodies(css, selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[}\\n])\\s*(${esc})\\s*\\{`, 'gm');
  const bodies = [];
  let m;
  while ((m = re.exec(css)) !== null) {
    const openBrace = css.indexOf('{', m.index);
    if (openBrace < 0) continue;
    let depth = 0;
    for (let i = openBrace; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) {
          bodies.push(css.slice(openBrace + 1, i));
          break;
        }
      }
    }
  }
  return bodies;
}

/** Prefer the rule body that defines frosted glass (blur + background). */
function extractRuleBody(css, selector) {
  const bodies = extractAllRuleBodies(css, selector);
  if (!bodies.length) return null;
  const scored = bodies.map((body) => {
    const hasBlur = /backdrop-filter\s*:/i.test(body);
    const hasBg = /background(?:-color)?\s*:/i.test(body);
    return { body, score: (hasBlur ? 2 : 0) + (hasBg ? 1 : 0) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].body;
}

function parseBlurPx(filterValue) {
  if (!filterValue) return 0;
  const m = String(filterValue).match(/blur\(\s*([\d.]+)\s*px\s*\)/i);
  return m ? Number(m[1]) : 0;
}

function isNonOpaqueBackground(decl) {
  if (!decl) return false;
  const v = decl.trim().toLowerCase();
  if (v === 'transparent' || v === 'none') return true;
  if (v.includes('var(--bg-secondary)') || v.includes('var(--bg-tertiary)')) return true;
  if (/rgba?\s*\(/.test(v) || /hsla?\s*\(/.test(v)) {
    // solid rgb without alpha is opaque; rgba/hsla with alpha < 1 is glass
    const alphaM = v.match(/rgba?\s*\(\s*[^)]+\)|hsla?\s*\(\s*[^)]+\)/);
    if (!alphaM) return true;
    const parts = alphaM[0].replace(/^[a-z]+\s*\(/i, '').replace(/\)$/, '').split(',');
    if (parts.length >= 4) {
      const a = Number(parts[3].trim());
      return !Number.isNaN(a) && a < 1;
    }
    // rgb(...) without alpha → opaque
    if (/^rgb\s*\(/.test(alphaM[0])) return false;
    return true;
  }
  // bare #rrggbb / named colors → opaque
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) {
    if (v.length === 9) {
      const a = parseInt(v.slice(7, 9), 16) / 255;
      return a < 1;
    }
    return false;
  }
  return false;
}

function prop(body, name) {
  const re = new RegExp(`${name}\\s*:\\s*([^;]+);`, 'i');
  const m = body.match(re);
  return m ? m[1].trim() : null;
}

function main() {
  if (!fs.existsSync(cssPath)) {
    fail(`missing shipped CSS: ${cssPath}`);
    return;
  }
  if (!fs.existsSync(htmlPath)) {
    fail(`missing settings page: ${htmlPath}`);
    return;
  }

  const css = fs.readFileSync(cssPath, 'utf8');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // settings page must load style.css
  if (!/href\s*=\s*["']style\.css["']/.test(html)) {
    fail('settings.html does not link style.css');
  } else {
    pass('settings.html links style.css');
  }

  // structure preserved
  const structureChecks = [
    ['settings-layout', /class\s*=\s*["'][^"']*settings-layout/],
    ['sidebar-nav', /class\s*=\s*["'][^"']*sidebar-nav/],
    ['settings-main', /class\s*=\s*["'][^"']*settings-main/],
    ['btn-top-right', /class\s*=\s*["'][^"']*btn-top-right/],
    ['nav-btn-general', /id\s*=\s*["']nav-btn-general["']/],
  ];
  for (const [label, re] of structureChecks) {
    if (!re.test(html)) fail(`settings.html missing structure: ${label}`);
    else pass(`settings.html has ${label}`);
  }

  // :root glass variable still translucent
  const rootBody = extractRuleBody(css, ':root');
  if (!rootBody) {
    fail('could not find :root rule in style.css');
  } else {
    const bgSec = prop(rootBody, '--bg-secondary');
    if (!bgSec) fail(':root missing --bg-secondary');
    else if (!isNonOpaqueBackground(bgSec) && !/rgba|hsla|var\(/i.test(bgSec)) {
      fail(`:root --bg-secondary looks fully opaque: ${bgSec}`);
    } else {
      pass(`:root --bg-secondary is glass-friendly: ${bgSec}`);
    }
  }

  const report = [];
  for (const sel of GLASS_SELECTORS) {
    const body = extractRuleBody(css, sel);
    if (!body) {
      fail(`no CSS rule for ${sel}`);
      continue;
    }
    const bg =
      prop(body, 'background-color') ||
      prop(body, 'background');
    const blur =
      prop(body, 'backdrop-filter') ||
      prop(body, '-webkit-backdrop-filter');
    const webkitBlur = prop(body, '-webkit-backdrop-filter');
    const stdBlur = prop(body, 'backdrop-filter');

    const blurPx = Math.max(parseBlurPx(stdBlur), parseBlurPx(webkitBlur), parseBlurPx(blur));
    const bgOk = isNonOpaqueBackground(bg);
    const blurOk = blurPx >= MIN_BLUR_PX;

    report.push({ sel, bg, stdBlur, webkitBlur, blurPx, bgOk, blurOk });

    if (!bgOk) fail(`${sel} background is missing or opaque: ${bg}`);
    else pass(`${sel} background translucent/glass: ${bg}`);

    if (!stdBlur && !webkitBlur) fail(`${sel} missing backdrop-filter`);
    else if (!blurOk) fail(`${sel} blur ${blurPx}px < ${MIN_BLUR_PX}px`);
    else {
      pass(`${sel} backdrop blur ${blurPx}px (std=${stdBlur}; webkit=${webkitBlur})`);
    }
  }

  console.log('\n--- declarations ---');
  for (const r of report) {
    console.log(JSON.stringify(r));
  }

  if (process.exitCode) {
    console.error('\nsettings frosted-glass check FAILED');
  } else {
    console.log('\nsettings frosted-glass check PASSED');
  }
}

main();
