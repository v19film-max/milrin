/* 출처: 자체 제작 모임 정산기(tool.js) 1~145줄 사본, 복사일 2026-11-07. 계산 코드는 고치지 않았고, 맨 끝 닫는 괄호 한 줄만 붙였다. */
/* 모임 정산기. 입력한 이름과 금액은 이 기기 안에서만 계산하고, 어디에도 저장하거나 보내지 않는다. */
(function (root) {
  'use strict';
  var MINP = 2, MAXP = 30, MAXI = 50, MAXA = 1000000000, LEN = 20, UNITS = [1, 10, 100, 1000];

  function fmt(n) { return (n < 0 ? '−' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function sgn(n) { return n > 0 ? '+' + fmt(n) : fmt(n); }
  function normAmt(s) { /* 전각 숫자·쉼표·부호·점을 반각으로(글자 수는 그대로) */
    return String(s).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 65248); })
      .replace(/[，､、]/g, ',').replace(/[．。｡]/g, '.').replace(/[－−–—‐]/g, '-').replace(/＋/g, '+');
  }
  /* 숫자만 뽑으면 뜻이 10배 이상 달라질 수 있는 입력: 소수점·음수 부호(숫자 앞에 먼저 쳐도 해당), 숫자와 함께 쓴 지수(e)·만/천/억/k/m 같은 단위 글자 */
  function badAmount(s) { var n = normAmt(s); return /[.\-]/.test(n) || (/\d/.test(n) && /[eE만천백억조kKmM]/.test(n)); }
  function parseAmount(s) { /* 숫자만 남긴다. 숫자가 없거나 badAmount면 NaN(조용히 다른 값으로 읽지 않는다) */
    if (badAmount(s)) return NaN;
    var d = normAmt(s).replace(/[^0-9]/g, '');
    return d && d.length < 16 ? Number(d) : NaN;
  }
  var SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  function clip(s, n) { /* 사용자가 보는 글자(ZWJ 이모지·결합 문자 포함) 기준으로 n자까지. Segmenter가 없으면 코드포인트 기준 */
    var a;
    if (SEG) { a = []; for (var g of SEG.segment(s)) a.push(g.segment); } else a = Array.from(s);
    return a.length > n ? a.slice(0, n).join('') : null;
  }
  /* 동적으로 만드는 id는 모두 이 접두사로 시작한다: 페이지의 정적 id와 겹치지 않는다 */
  var IDP = 'sb-';
  function did(k, u) { return IDP + k + u; }

  /* 이름 정리: 쉼표·줄바꿈으로 나누고, 20자 제한, 이미 있는 이름과 같으면 (2)처럼 번호 */
  function parseNames(text, existing) {
    var parts = String(text).split(/[\n\r\t,，、;；]+/), names = [], seen = Object.create(null), cut = 0, renamed = 0, i;
    for (i = 0; i < (existing || []).length; i++) seen['$' + existing[i]] = 1;
    for (i = 0; i < parts.length; i++) {
      var s = parts[i].replace(/\s+/g, ' ').trim();
      if (!s) continue;
      var cs = clip(s, LEN);
      if (cs != null) { s = cs.trim(); cut++; }
      var base = s, k = 1;
      while (seen['$' + s]) { k++; s = base + ' (' + k + ')'; }
      if (k > 1) renamed++;
      seen['$' + s] = 1; names.push(s);
    }
    return { names: names, cut: cut, renamed: renamed };
  }

  /* 항목 하나를 참여자에게 나눈다: 원 단위 정수. 나머지 1원씩은 명단 순서(cursor부터 한 바퀴)로 한 명에게 1원씩 더 준다.
     다음 항목은 마지막으로 더 낸 사람의 다음 사람부터 시작한다. idxs = 참여자의 명단 위치 */
  function shareItem(amount, idxs, n, cursor) {
    var m = idxs.length, base = Math.floor(amount / m), r = amount - base * m, rem = r, set = {}, out = {}, last = -1, k;
    idxs.forEach(function (i) { set[i] = true; out[i] = base; });
    for (k = 0; k < n && r > 0; k++) {
      var p = (cursor + k) % n;
      if (set[p]) { out[p]++; r--; last = p; }
    }
    return { sh: out, cursor: last < 0 ? cursor : (last + 1) % n, rem: rem };
  }

  /* 반올림 단위 맞추기: 사람마다 단위의 배수가 되게 하되 합계는 0으로 유지한다.
     내림한 뒤 모자라는 단위 수(K)를 내림 잔여가 큰 사람부터 한 단위씩 올린다(같으면 명단 순서). 누구도 정확한 값에서 단위 미만으로만 벗어난다 */
  function roundNets(net, u) {
    if (u === 1) return net.slice();
    var fl = [], fr = [], S = 0;
    net.forEach(function (v) { var f = Math.floor(v / u); fl.push(f); fr.push(v - f * u); S += f; });
    var order = net.map(function (_, i) { return i; }).sort(function (a, b) { return fr[b] - fr[a] || a - b; });
    for (var j = 0; j < -S; j++) fl[order[j]]++;
    return fl.map(function (f) { return f * u; });
  }

  /* 송금 목록: 같은 금액끼리 먼저 짝짓고, 남은 사람은 가장 많이 보낼 사람 → 가장 많이 받을 사람 순으로 맞춘다(그리디). 최대 (돈이 오가는 사람 수 − 1)건 */
  function settle(nets) {
    var deb = [], cre = [], out = [];
    nets.forEach(function (v, i) { if (v < 0) deb.push({ i: i, a: -v }); else if (v > 0) cre.push({ i: i, a: v }); });
    var cmp = function (x, y) { return y.a - x.a || x.i - y.i; };
    deb.sort(cmp); cre.sort(cmp);
    deb.forEach(function (d) {
      for (var k = 0; k < cre.length; k++) {
        if (cre[k].a === d.a) { out.push({ from: d.i, to: cre[k].i, amount: d.a }); cre.splice(k, 1); d.a = 0; return; }
      }
    });
    deb = deb.filter(function (d) { return d.a > 0; });
    while (deb.length && cre.length) {
      deb.sort(cmp); cre.sort(cmp);
      var d = deb[0], c = cre[0], t = Math.min(d.a, c.a);
      out.push({ from: d.i, to: c.i, amount: t });
      d.a -= t; c.a -= t;
      if (!d.a) deb.shift();
      if (!c.a) cre.shift();
    }
    return out;
  }

  function checkItem(it, ids) { /* '' | 'amount' | 'payer' | 'parts' */
    if (!(Number.isInteger(it.amount) && it.amount >= 1 && it.amount <= MAXA)) return 'amount';
    if (it.payer == null || !(it.payer in ids)) return 'payer';
    if (!it.parts || !it.parts.length) return 'parts';
    for (var i = 0; i < it.parts.length; i++) if (!(it.parts[i] in ids)) return 'parts';
    return '';
  }

  /* inp: { people:[{id,name}], items:[{amount, payer(id), parts:[id], name}], unit } */
  function calc(inp) {
    var P = inp.people, n = P.length, ids = {}, i;
    if (n < MINP || n > MAXP) return { ok: false, code: 'people' };
    if (!inp.items.length || inp.items.length > MAXI) return { ok: false, code: 'items' };
    if (UNITS.indexOf(inp.unit) < 0) return { ok: false, code: 'unit' };
    P.forEach(function (p, k) { ids[p.id] = k; });
    for (i = 0; i < inp.items.length; i++) { var c = checkItem(inp.items[i], ids); if (c) return { ok: false, code: c, i: i }; }
    var paid = [], burden = [], total = 0, rem = 0, cursor = 0;
    for (i = 0; i < n; i++) { paid.push(0); burden.push(0); }
    inp.items.forEach(function (it) {
      var set = {}, idxs = [];
      it.parts.forEach(function (id) { if (!set[ids[id]]) { set[ids[id]] = true; idxs.push(ids[id]); } });
      idxs.sort(function (a, b) { return a - b; });
      var r = shareItem(it.amount, idxs, n, cursor);
      cursor = r.cursor; rem += r.rem; total += it.amount;
      paid[ids[it.payer]] += it.amount;
      idxs.forEach(function (k) { burden[k] += r.sh[k]; });
    });
    var net = paid.map(function (v, k) { return v - burden[k]; });
    var fin = roundNets(net, inp.unit), tx = settle(fin);
    var rows = P.map(function (p, k) { return { id: p.id, name: p.name, paid: paid[k], burden: burden[k], net: net[k], final: fin[k], adj: fin[k] - net[k] }; });
    var moved = 0;
    rows.forEach(function (r) { if (r.adj > 0) moved += r.adj; });
    return {
      ok: true, total: total, unit: inp.unit, rem: rem, rows: rows, moved: moved,
      transfers: tx.map(function (t) { return { from: P[t.from].name, to: P[t.to].name, fromId: P[t.from].id, toId: P[t.to].id, amount: t.amount }; })
    };
  }

  /* 채팅에 붙여 넣을 요약. 계좌번호는 넣지 않는다 */
  function text(res, items) {
    var L = ['[모임 정산] 총 ' + fmt(res.total) + '원 · ' + res.rows.length + '명 (반올림 ' + fmt(res.unit) + '원 단위)', '', '▶ 송금'];
    if (res.transfers.length) res.transfers.forEach(function (t) { L.push(t.from + ' → ' + t.to + ' ' + fmt(t.amount) + '원'); });
    else L.push('주고받을 돈이 없어요');
    L.push('', '▶ 사람별 (낸 돈 / 부담액 / 받을 돈+·보낼 돈−)');
    res.rows.forEach(function (r) { L.push(r.name + ' ' + fmt(r.paid) + ' / ' + fmt(r.burden) + ' / ' + sgn(r.final)); });
    if (items && items.length) {
      L.push('', '▶ 항목');
      items.forEach(function (it, i) { L.push((i + 1) + '. ' + (it.name || '항목 ' + (i + 1)) + ' ' + fmt(it.amount) + '원 (' + it.payerName + ' 결제, ' + it.count + '명 참여)'); });
    }
    L.push('', '※ 참고용 계산이에요. 송금 전에 금액을 한 번 더 확인해 주세요.');
    return L.join('\n');
  }

  root.SPLIT = { MINP: MINP, MAXP: MAXP, MAXI: MAXI, MAXA: MAXA, UNITS: UNITS, fmt: fmt, parseAmount: parseAmount, badAmount: badAmount, normAmt: normAmt, clip: clip, did: did, IDP: IDP, parseNames: parseNames, shareItem: shareItem, roundNets: roundNets, settle: settle, checkItem: checkItem, calc: calc, text: text };
})(typeof window !== 'undefined' ? window : globalThis);
