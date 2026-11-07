// 가안과 상수는 전부 이 파일 한 곳에 모은다. 코드 안에 숫자를 직접 쓰지 않는다.
export const CONFIG = Object.freeze({
  // 가안 — 나중에 바꿀 수 있음 (문구 3판 9절)
  REST_DAYS: [0, 3, 7, 14, 30],     // 요청 횟수 0·1·2·3·4회 이상 뒤 쉬는 기간(일)
  PASS_DAYS: 3,                     // 오늘은 패스
  AMOUNT_TIERS: [50000, 200000],    // 메인 한 줄 금액 단계
  PARTIAL_PAYMENT: true,            // 일부만 받음 켜고 끄기
  T4_IDLE_SEC: 5,                   // 첫 카드 안내가 뜨기까지
  // 이 스펙의 추가 상수
  FIRST_SHOW_MIN_DAYS: 1, UNDO_SEC: 6, BACKUP_NUDGE_DAYS: 7,
  DAWN_CUT_HOUR: 6, NIGHT_GAP_HOURS: 6, SETTLE_UNIT: 1,
  GUESS_MIN: 3, GUESS_GAP: 1, GUESS_RECENT_DAYS: 60,
  GUESS_W: { chain: 4, merchant: 3, weekday: 2, tod: 2, amount: 1, recent: 1 },
  STAGE_MAX: 4, HOLD_MS: 700, HOLD_IGNORE_MS: 150,
  EXPERIMENT_DAYS: 28, SHOW_REACT_DAYS: 7,
  MAX_PASTE_LINES: 100, MAX_LINE: 200, MAX_NAME: 20, MAX_MERCHANT: 40,
  MAX_PEOPLE: 500, MAX_GROUPS: 100, MAX_PAYMENTS: 5000, MAX_ENTRIES: 5000,
  MAX_IMPORT_BYTES: 5 * 1024 * 1024, MAX_AMOUNT: 1000000000,
  // 이 구현의 추가 상수
  HOLD_ALL_MS: 1500,                // 모두 지우기 길게 누르기
  REASON_MAX_CHARS: 22,             // 근거 한 줄 이어 붙이기 한도
  LOG_KEEP_DAYS: 120, LOOKBACK_REST_FALLBACK: 0,
  TAXI_WORDS: ['택시', 'taxi', '카카오t', '티맵'],
  MAX_PERSON_LOG: 2000,
});
