import { h, nav } from '../dom.js';
import { UI } from '../../copy.js';

// 오픈소스 고지. 이번 판은 외부 코드를 쓰지 않았다(THIRD_PARTY.md 부품별 기록 참고).
export function render(app) {
  return h('div', { class: 'page licenses' }, nav(app), h('div', { class: 'ttl' }, h('h1', { text: '오픈소스 고지' })),
    h('div', { class: 'panel lic-body stagger' }, UI.licenses.map((t) => h('p', { text: t }))));
}
