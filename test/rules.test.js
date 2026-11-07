import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const walk = (dir, out = []) => { for (const e of readdirSync(new URL(dir, root), { withFileTypes: true })) { const p = dir + e.name; if (e.isDirectory()) walk(p + '/', out); else if (!e.name.startsWith('.')) out.push(p); } return out; };
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const codeFiles = () => [...walk('src/'), ...walk('lib/')].filter((f) => f.endsWith('.js'));

test('I1 외부 주소·통신 호출이 없음', () => {
  const files = [...codeFiles(), ...walk('css/'), 'index.html'];
  const bad = [];
  for (const f of files) {
    let t = read(f);
    t = t.split('http://www.w3.org/2000/svg').join('');   // 그림 이름공간 글자(요청 아님)
    if (!f.endsWith('.html')) t = stripComments(t);
    if (/https?:\/\//.test(t)) bad.push(`${f}: 외부 주소`);
    if (/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts)\b/.test(t)) bad.push(`${f}: 통신 호출`);
  }
  assert.deepEqual(bad, []);
});
test('I2 innerHTML·insertAdjacentHTML·document.write 사용 없음', () => {
  const bad = codeFiles().filter((f) => /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function/.test(stripComments(read(f))));
  assert.deepEqual(bad, []);
});
test('I3 CSS에 font-size 15px 미만과 알약 모양이 없음', () => {
  const bad = [];
  for (const f of walk('css/')) {
    const t = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of t.matchAll(/font-size\s*:\s*([^;}]+)/g)) {
      const v = m[1].trim();
      const px = /^([\d.]+)px$/.exec(v);
      if (!px) { if (!/^(var\(|inherit)/.test(v)) bad.push(`${f}: font-size ${v}`); continue; }
      if (+px[1] < 15) bad.push(`${f}: font-size ${v}`);
    }
    for (const m of t.matchAll(/border-radius\s*:\s*([^;}]+)/g)) for (const n of m[1].match(/[\d.]+(?=px)/g) || []) if (+n >= 999) bad.push(`${f}: radius ${m[1]}`);
    if (/(?<![-\w])font\s*:/.test(t)) bad.push(`${f}: font 약식 속성`);
  }
  assert.deepEqual(bad, []);
});
test('I4 config.js 밖에서 가안 숫자를 직접 쓰지 않음(간이 검사)', () => {
  const bad = [];
  for (const f of walk('src/').filter((x) => x.endsWith('.js') && !x.endsWith('config.js'))) {
    const t = stripComments(read(f));
    if (/\b(50000|200000)\b/.test(t)) bad.push(`${f}: 금액 단계`);
    if (/\[\s*0\s*,\s*3\s*,\s*7\s*,\s*14\s*,\s*30\s*\]/.test(t)) bad.push(`${f}: 쉬는 기간 표`);
    if (/PASS_DAYS\s*[:=]\s*\d|REST_DAYS\s*[:=]\s*\[/.test(t)) bad.push(`${f}: 상수 재정의`);
  }
  assert.deepEqual(bad, []);
});
