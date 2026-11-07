import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../apps/web/src/duel/attackGesture.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {AttackGesture,DOUBLE_ATTACK_MS}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('single tap commits one light after the recognition window',()=>{
  const gesture=new AttackGesture();gesture.press(0);
  assert.equal(gesture.sample(DOUBLE_ATTACK_MS-1),null);
  assert.equal(gesture.sample(DOUBLE_ATTACK_MS+1),'light');
  assert.equal(gesture.sample(999),null);
});
test('double tap commits only a heavy even when frames sample between presses',()=>{
  const gesture=new AttackGesture();gesture.press(0);assert.equal(gesture.sample(50),null);gesture.press(110);
  assert.equal(gesture.sample(120),'heavy');assert.equal(gesture.sample(500),null);
});
test('two taps outside the window remain two independent light attacks',()=>{
  const gesture=new AttackGesture();gesture.press(0);gesture.press(DOUBLE_ATTACK_MS+10);
  assert.equal(gesture.sample(DOUBLE_ATTACK_MS+11),'light');
  assert.equal(gesture.sample(DOUBLE_ATTACK_MS*2+12),'light');
});
test('pause, blur, and cancellation discard pending and queued attacks',()=>{
  const gesture=new AttackGesture();gesture.press(0);gesture.reset();assert.equal(gesture.sample(500),null);
  gesture.press(600);gesture.press(700);gesture.reset();assert.equal(gesture.sample(900),null);
});
test('three quick presses pair into a heavy followed by a light',()=>{
  const gesture=new AttackGesture();gesture.press(0);gesture.press(50);gesture.press(100);
  assert.equal(gesture.sample(150),'heavy');assert.equal(gesture.sample(301),'light');assert.equal(gesture.sample(500),null);
});
