import { readFileSync } from 'node:fs';
for (const id of ['karen', 'taren', 'nomet']) {
  const b = readFileSync(`apps/web/public/models/characters/${id}-fantasy-v2.glb`);
  const j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)));
  console.log(JSON.stringify({ id, nodes: j.nodes.filter(n => /^(root|spine|neck|head|upperarm|lowerarm|wrist|upperleg|lowerleg|foot)/i.test(n.name)).map(n => ({ name: n.name, t: n.translation, r: n.rotation })), idle: j.animations.filter(a => /^(Idle|Lobby_Idle|Guard)$/.test(a.name)).map(a => ({ name: a.name, channels: a.channels.length, targets: a.channels.filter(c => c.target.path === 'translation').map(c => j.nodes[c.target.node].name) })) }));
}
