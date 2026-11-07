import { CONFIG } from '../config.js';

// 금액 단계: 0 조금, 1 꽤, 2 많이. "이상"이 위 단계
export function tierOf(S, cfg = CONFIG) {
  let t = 0;
  for (const b of cfg.AMOUNT_TIERS) if (S >= b) t++;
  return t;
}
const TIER_IDS = [['H1', 'H2'], ['H4', 'H5', 'H6'], ['H7', 'H8', 'H9']];

// ctx: { S 받아낼 돈, openCount 열린 건 수, O 줄 돈 후보 합, pendingCount 넘길 카드 수, justZero 방금 0원 }
export function candidatesFor(ctx, cfg = CONFIG) {
  const { S, openCount, O, pendingCount, justZero } = ctx;
  if (S <= 0 && justZero) return ['H11'];
  if (S > 0) {
    const t = tierOf(S, cfg);
    return t === 0 && openCount <= 3 ? ['H3', 'H1', 'H2'] : TIER_IDS[Math.min(t, TIER_IDS.length - 1)].slice();
  }
  if (O > 0) return ['H13', 'H14'];
  if (pendingCount > 0) return ['H12'];
  return ['H10'];
}
// 3건 이하이면 H3 우선. 직전에 뜬 번호는 피한다. rng는 0~1 값을 주는 함수(시험에서 고정)
export function pickHeadline(ctx, rng = Math.random, cfg = CONFIG) {
  let c = candidatesFor(ctx, cfg);
  if (c[0] === 'H3') c = c[0] !== ctx.lastH ? ['H3'] : c.slice(1);
  const avoid = c.filter((x) => x !== ctx.lastH);
  const pool = avoid.length ? avoid : c;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}
// 카드를 다 넘긴 뒤 한 줄. D3 위로 넘긴 카드가 남음, D2 이번에 카드를 처리했고 남은 게 없음, D1 기본
export function doneKey({ laterCount, handled }) {
  if (laterCount > 0) return 'D3';
  return handled > 0 ? 'D2' : 'D1';
}
