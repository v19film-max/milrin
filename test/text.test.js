import test from 'node:test';
import assert from 'node:assert/strict';
import { nameKey, cleanText, merchantKey, merchantMatch, ahYa, clipText, findByName } from '../src/core/text.js';
import { mkDb, addPerson } from './h.js';

test('A1 분해형(NFD)과 조합형(NFC) 이름은 같은 키', () => {
  const nfd = '철수'.normalize('NFD');
  assert.notEqual(nfd, '철수');
  assert.equal(nameKey(nfd), nameKey('철수'));
  assert.equal(cleanText(nfd), '철수');
});
test('A2 앞뒤·중복 공백과 제로폭 문자 제거', () => {
  assert.equal(cleanText('  철 ​ 수   '), '철 수');
  assert.equal(cleanText('﻿영‍희 '), '영희');
});
test('A3 동명이인은 번호로 따로 저장되고 이름 검색은 후보를 모두 돌려준다', () => {
  const db = mkDb();
  const a = addPerson(db, '철수'); const b = addPerson(db, '철수'); addPerson(db, '영희');
  assert.notEqual(a, b);
  assert.deepEqual(findByName(db.people, '철수'.normalize('NFD')).map((p) => p.id), [a, b]);
});
test('A4 영문 대소문자는 같은 키', () => { assert.equal(nameKey('Alex'), nameKey(' aLEX ')); });
test('A5 가맹점 키: 공백·구두점·분해형 무시, 3글자 이상 포함 관계 일치, 2글자는 불일치', () => {
  assert.equal(merchantKey('을지로  곱창!'), merchantKey('을지로곱창'));
  assert.equal(merchantKey('을지로 곱창'.normalize('NFD')), merchantKey('을지로곱창'));
  assert.ok(merchantMatch('을지로 곱창', '을지로곱창 본점'));
  assert.ok(!merchantMatch('곱창', '곱창집 본점'));
  assert.ok(merchantMatch('곱창집', '을지로 곱창집'));
  assert.ok(!merchantMatch('', '곱창집'));
});
test('A6 받침 판정', () => {
  assert.equal(ahYa('철수'), '야'); assert.equal(ahYa('민준'), '아');
  assert.equal(ahYa('Alex'), '~'); assert.equal(ahYa('철수2'), '~'); assert.equal(ahYa('철수!'), '~');
});
test('A7 20자 자르기가 이모지·결합 문자를 깨지 않음', () => {
  const s = '가'.repeat(19) + '👨‍👩‍👧' + '나';
  const r = clipText(s, 20);
  assert.equal(r, '가'.repeat(19) + '👨‍👩‍👧');
  assert.equal(clipText('짧아', 20), '짧아');
});
test('A8 가맹점 12자 자르기', () => {
  assert.equal(clipText('가나다라마바사아자차카타파하', 12), '가나다라마바사아자차카타');
});
