import { h, icon, nav } from '../dom.js';
import { COPY, UI } from '../../copy.js';
import { loadExample } from '../../core/example.js';

export function render(app) {
  const store = app.store;
  const replay = store.db.settings.hint.welcomeDone;
  const finish = (withExample) => {
    store.update((db) => {
      db.settings.hint.welcomeDone = true;
      if (withExample && !db.settings.exampleLoaded) loadExample(db, app.today(), app.now());
    });
    app.go('#/');
  };
  const dirs = h('div', { class: 'demo glass', role: 'img', 'aria-label': '카드를 오른쪽으로 밀면 맞아, 왼쪽은 아니야, 위는 기억 안 나' },
    h('span', { class: 'dir d-u' }, icon('up'), '기억 안 나'),
    h('span', { class: 'dir d-l' }, icon('left'), '아니야'),
    h('span', { class: 'dir d-r' }, '맞아', icon('chev')),
    h('span', { class: 'dir-c', text: '누르면 고쳐' }));
  return h('div', { class: 'page welcome' },
    replay ? nav(app) : null,
    h('div', { class: 'ttl' }, h('h1', { text: '밀린 정산함' }), h('p', { text: UI.welcomeSub })),
    dirs,
    h('div', { class: 'notice' },
      h('p', { class: 'note', text: UI.welcomeNotice }),
      h('p', { class: 'note', text: COPY.R1[1] }),
      h('p', { class: 'note', text: COPY.R1[2] })),
    h('div', { class: 'welcome-btns' },
      replay ? h('button', { class: 'cta', type: 'button', text: '닫기', onclick: () => app.back() })
        : [h('button', { class: 'cta', type: 'button', text: '예시로 해보기', onclick: () => finish(true) }),
          h('button', { class: 'tbtn', type: 'button', text: '바로 시작', onclick: () => finish(false) })]));
}
