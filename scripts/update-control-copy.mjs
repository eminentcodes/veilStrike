import { readFile, writeFile } from 'node:fs/promises';
const edits = [
  ['apps/web/src/App.tsx', "['J / LEFT CLICK','Light attack; chain your hits'],['K','Heavy attack; pressure a guard']", "['J / LEFT CLICK','Attack once for light; twice quickly for heavy']"],
  ['apps/web/src/duel/DuelGame.tsx', '<span>J / Left click <b>Light attack; chain three cuts</b></span><span>K <b>Heavy attack; breaks guard</b></span>', '<span>J / Left click <b>One press: light · Two quick presses: heavy</b></span>'],
  ['apps/web/src/duel/roster.ts', 'size: 1.13, height: 2.77', 'size: 1.25, height: 3.06'],
];
for (const [file, before, after] of edits) {
  const source = await readFile(file, 'utf8');
  if (source.includes(before)) await writeFile(file, source.replace(before, after));
  else if (!source.includes(after)) throw new Error('Expected text missing in ' + file);
}
