import { h, icon, won, clear } from '../dom.js';
import { COPY, UI } from '../../copy.js';
import { CONFIG } from '../../config.js';
import { createCardStack } from '../widgets/card-stack.js';
import { countTo } from '../widgets/count.js';
import { openFlip } from '../widgets/flip.js';
import { buildCardBack } from '../cardback.js';
import { frameOf, reasonLine } from '../../core/guess.js';
import { todayQueue, laterCards, swipeLater, rejectCard, rightSwipe } from '../../core/cards.js';
import { totalOwed, openCount, owesTotal, pickShow, personName, daysLabel } from '../../core/ledger.js';
import { pickHeadline, candidatesFor, doneKey } from '../../core/headline.js';
import { shouldNudge } from '../../core/backup.js';
import { hasExample } from '../../core/example.js';

export function render(app) {
  const store = app.store, cfg = CONFIG;
  const today = app.today(), now = app.now();
  const S = app.session;
  let show = null, hid = null;
  store.update((db) => {
    show = pickShow(db, today, now, cfg);
    const ctx = headCtx(db);
    hid = pickHeadline({ ...ctx, lastH: db.settings.lastPick.H }, Math.random, cfg);
    db.settings.lastPick.H = hid;
    if (S.justZero) S.justZero = false;
  });
  const nudge = shouldNudge(store.db, now, today, cfg);
  if (nudge) store.update((db) => { db.settings.nudgeDay = today; });

  function headCtx(db) {
    return { S: totalOwed(db), openCount: openCount(db), O: owesTotal(db), pendingCount: todayQueue(db, today).length, justZero: !!S.justZero };
  }

  // ---------- 위쪽 ----------
  const amountNum = h('span', { class: 'num' });
  const hero = h('div', { class: 'hero' });
  const hline = h('p', { class: 'hline' });
  const subRow = h('p', { class: 'sub num' });
  const oldRow = h('div', { class: 'old-row' });
  function paintHero(first, textChanged = true) {
    const db = store.db, total = totalOwed(db), oc = openCount(db), ow = owesTotal(db);
    countTo(app, amountNum, first ? (S.lastTotal ?? total) : S.lastTotal ?? total, total);
    S.lastTotal = total;
    // H 줄
    clear(hline);
    if (textChanged) { hline.classList.remove('swap'); void hline.offsetWidth; hline.classList.add('swap'); }
    if (hid === 'H14') hline.append(h('button', { class: 'linkline', type: 'button', onclick: () => app.go('#/owes') }, COPY.H14, icon('chev', 'sm')));
    else hline.append(COPY[hid]);
    // sub 줄
    clear(subRow);
    if (oc > 0) {
      subRow.append(`찾아낸 정산 ${oc}건`);
      if (ow > 0) subRow.append(' · ', h('button', { class: 'sublink', type: 'button', text: `줄 돈일 수도 ${won(ow)}원`, onclick: () => app.go('#/owes') }));
    }
    subRow.hidden = oc === 0;
    clear(oldRow);
    if (show) {
      const name = personName(db, show.personId);
      const lab = daysLabel(show.days);
      oldRow.append(
        h('button', { class: 'old', type: 'button', 'aria-label': `${name} ${lab}. 누르면 받아내기로 이동`, onclick: () => app.go(`#/ask/${show.personId}`) }, `${name} ${lab}`, icon('chev', 'sm')),
        show.others > 0 ? h('span', { class: 'others', text: `외 ${show.others}명` }) : null);
    }
  }
  hero.append(h('p', { class: 'lab', text: '받아낼 돈' }), h('b', { class: 'amount' }, amountNum, h('small', { text: '원' })), hline, subRow, oldRow);

  // ---------- 카드 더미 ----------
  let stack;
  const t4 = h('p', { class: 't4', 'aria-hidden': 'true' });
  const live = (msg) => app.say(msg);
  const queueNow = () => {
    const q = todayQueue(store.db, today);
    if (S.focusCard != null) { const i = q.findIndex((p) => p.id === S.focusCard); if (i > 0) q.unshift(q.splice(i, 1)[0]); }
    return q;
  };
  const describe = (p) => {
    const db = store.db;
    const f = frameOf(db, p);
    return { f, text: p.kind === 'gap' ? f.lines.join(' ') : f.text };
  };
  const hooks = {
    getQueue: queueNow,
    label(p) {
      const d = describe(p);
      const what = p.merchant || (p.kind === 'gap' ? '빠진 차수' : UI.untitledPay);
      return `추측 카드. ${what}${p.amount ? ` ${won(p.amount)}원` : ''}. ${d.text}. 오른쪽으로 밀면 맞아, 왼쪽은 아니야, 위는 기억 안 나. 누르면 뒤집어서 고치기`;
    },
    face(p) {
      const { f } = describe(p);
      if (p.kind === 'gap') {
        const nodes = [];
        if (f.frame === 'B1') {
          const [a, b] = f.lines[0].split(', ');
          nodes.push(h('p', { class: 'ask' }, a + ',', h('br'), b), h('p', { class: 'ask-who', text: f.lines[1] }));
        } else if (f.frame === 'B4') {
          const [a, b] = f.lines[0].split('. ');
          nodes.push(h('p', { class: 'ask' }, a + '.'), h('p', { class: 'ask-who', text: b }));
        } else nodes.push(h('p', { class: 'ask-who', text: f.lines[0] }));
        return [h('div', { class: 'gap-face' }, nodes)];
      }
      const reason = reasonLine(store.db, p, f.groupId);
      const what = p.merchant || UI.untitledPay;
      let g1 = f.text, g2 = null;
      const cut = f.frame === 'C1' ? f.text.indexOf('? ') + 1 : f.frame === 'C2' || f.frame === 'C4' ? f.text.indexOf(', ') + 1 : 0;
      if (cut > 0) { g1 = f.text.slice(0, cut); g2 = f.text.slice(cut).trim(); }
      return [
        h('div', {}, h('p', { class: 'what', text: what }), h('p', { class: 'amt num' }, won(p.amount), h('small', { text: '원' }))),
        h('p', { class: 'guess' }, g1, g2 ? [h('br'), h('em', { text: g2 })] : null),
        reason ? h('p', { class: 'why', text: reason }) : h('p', { class: 'why' }),
      ];
    },
    onYes(p) {
      const db = store.db;
      const f = frameOf(db, p);
      if (p.kind === 'gap' || f.groupId == null || !f.attendeeIds.length) return { flip: true };
      let r;
      store.update((d) => { r = rightSwipe(d, p.id, today, app.now(), cfg); }, { undo: true });
      if (r && r.ok) {
        cancelT4(true);
        const what = p.merchant || UI.untitledPay;
        live(`${what} ${won(p.amount)}원을 맞아로 넘겼어`);
        app.toast.show(COPY.T1, { undo: undoAndRefresh, ms: cfg.UNDO_SEC * 1000 });
        afterChange();
      }
      return r;
    },
    onNo(p) {
      const f = frameOf(store.db, p);
      cancelT4(true);
      store.update((d) => rejectCard(d, p.id, f.groupId, today));
      live(`${p.merchant || UI.untitledPay}을 아니야로 넘겼어`);
      app.toast.show(COPY.T2, { ms: 2600 });
    },
    onLater(p) {
      cancelT4(true);
      store.update((d) => swipeLater(d, p.id, today), { undo: true });
      live(`${p.merchant || UI.untitledPay}을 나중에로 넘겼어`);
      app.toast.show(COPY.T3, { undo: undoAndRefresh, ms: cfg.UNDO_SEC * 1000 });
      afterChange();
    },
    openBack(p, mode, cardEl) {
      cancelT4(true);
      S.focusCard = null;
      if (!cardEl) cardEl = stack.front;
      openFlip(app, cardEl, (panel, ctl) => {
        buildCardBack(app, panel, ctl, p.id, mode, (res) => {
          if (res.kind === 'saved') {
            live(`${p.merchant || UI.untitledPay}을 저장했어`);
            if (res.result && res.result.toast === 'Z1') app.toast.show([COPY.T1, COPY.Z1], { undo: undoAndRefresh, ms: cfg.UNDO_SEC * 1000 });
            else app.toast.show(COPY.T1, { undo: undoAndRefresh, ms: cfg.UNDO_SEC * 1000 });
          } else if (res.kind === 'dismissed') app.toast.show('정산이 아니라고 적었어', { undo: undoAndRefresh, ms: cfg.UNDO_SEC * 1000 });
        });
      }, ({ saved }) => {
        if (saved) { stack.advance(null); afterChange(); }
      });
    },
    emptyNode() {
      const db = store.db;
      const key = doneKey({ laterCount: laterCards(db, today).length, handled: S.handled || 0 });
      return h('div', { class: 'done-card' },
        h('p', { class: 'done-t', text: COPY[key] }),
        h('button', { class: 'tbtn', type: 'button', text: '결제 추가', onclick: () => app.go('#/add') }));
    },
  };
  function undoAndRefresh() { store.undo(); S.handled = Math.max(0, (S.handled || 0) - 1); stack.mount(); afterChange(); }
  function afterChange() {
    S.handled = (S.handled || 0) + 1;
    // 같은 구간이면 문구를 그대로 둔다(구간이 바뀔 때만 새로 고름)
    const prev = hid;
    store.update((db) => {
      const ctx = headCtx(db);
      if (!candidatesFor(ctx, cfg).includes(hid)) {
        hid = pickHeadline({ ...ctx, lastH: db.settings.lastPick.H }, Math.random, cfg);
        db.settings.lastPick.H = hid;
      }
    });
    paintHero(false, prev !== hid);
    paintFoot();
  }
  stack = createCardStack(app, hooks, cfg);

  // ---------- 아래 ----------
  const d4 = h('p', { class: 'd4' });
  const cta = h('button', { class: 'cta main-cta', type: 'button' });
  function paintFoot() {
    const db = store.db, total = totalOwed(db);
    d4.textContent = total > 0 && stack.size === 0 ? COPY.D4 : '';
    d4.hidden = !d4.textContent;
    cta.textContent = total > 0 ? '받아내기' : '결제 추가';
    cta.onclick = () => app.go(total > 0 ? '#/ledger' : '#/add');
  }
  const topRow = h('div', { class: 'nav main-nav' },
    h('span', { class: 'brand', text: '' }),
    h('div', { class: 'nav-r' },
      h('button', { class: 'tbtn', type: 'button', text: '장부', onclick: () => app.go('#/ledger') }),
      h('button', { class: 'tbtn', type: 'button', text: '추가', onclick: () => app.go('#/add') }),
      h('button', { class: 'tbtn', type: 'button', text: '설정', onclick: () => app.go('#/settings') })));
  const nudgeBtn = nudge ? h('button', { class: 'nudge', type: 'button', onclick: () => app.go('#/backup') }, '장부를 내보내기로 저장해 둘까?', icon('chev', 'sm')) : null;

  const page = h('div', { class: 'page main' }, topRow, hero, nudgeBtn, stack.el, t4, d4, cta);
  page.querySelector('.stack').parentNode.insertBefore(h('div', { class: 'main-fill' }), d4);
  paintHero(true); paintFoot();

  // 첫 카드 안내(T4): 처음 한 번, 몇 초 넘기지 않을 때
  let t4Timer = null;
  function cancelT4(done) {
    clearTimeout(t4Timer);
    if (done) { t4.classList.remove('on'); }
  }
  if (!store.db.settings.hint.t4Done && stack.size > 0) {
    t4Timer = setTimeout(() => {
      t4.textContent = COPY.T4; t4.classList.add('on');
      store.update((db) => { db.settings.hint.t4Done = true; });
    }, cfg.T4_IDLE_SEC * 1000);
  }
  // 담은 직후 카드가 올라오는 연출
  if (S.rise) { S.rise = false; stack.el.classList.add('rise'); setTimeout(() => stack.el.classList.remove('rise'), 700); }
  // 그날 밤 화면에서 빈칸을 눌러 들어온 경우: 그 카드를 앞에 올려 뒤집힌 상태로
  if (S.focusCard != null && stack.size > 0) {
    const id = S.focusCard;
    setTimeout(() => { const q = queueNow(); if (q[0] && q[0].id === id && stack.front) hooks.openBack(q[0], 'tap', stack.front); }, app.reduce() ? 200 : 420);
  }
  // 예시 지우기 안내(첫 실제 입력 뒤 한 번)
  const db0 = store.db;
  if (hasExample(db0) && !db0.settings.hint.exampleTip && (db0.payments.some((p) => !p.example) || db0.entries.some((e) => !e.example))) {
    store.update((db) => { db.settings.hint.exampleTip = true; });
    setTimeout(() => app.toast.show(UI.exampleTip, { ms: 4500 }), 500);
  }
  // H11은 이번 실행에 한 번만
  page.destroy = () => { clearTimeout(t4Timer); };
  return page;
}
