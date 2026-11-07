import { useEffect, useState } from 'react';
import { HandFist, Shield, Sparkle, Sword } from '@phosphor-icons/react';
import { CHAMPIONS } from '@/duel/catalog';
import type { ChampionId } from '@/duel/catalog';

const portraits = new Set<ChampionId>(['karen', 'taren', 'nomet', 'veyra', 'mawren']);
export function FighterPortrait({ id, className = '' }: { id: ChampionId; className?: string }) {
  const [failedId, setFailedId] = useState<ChampionId | null>(null);
  const source = import.meta.env.BASE_URL + 'images/fighters/' + id + '.webp?v=1';
  useEffect(() => { setFailedId(null); }, [id, source]);
  const Icon = id === 'taren' ? Shield : id === 'nomet' ? HandFist : id === 'mawren' ? Sparkle : Sword;
  return portraits.has(id) && failedId !== id
    ? <img className={'fighter-card-image ' + className} src={source}
        alt={CHAMPIONS[id].name + ', ' + CHAMPIONS[id].title.toLowerCase()} decoding="async" width="480" height="640" onError={() => setFailedId(id)}/>
    : <div className={'fighter-card-placeholder ' + className} aria-hidden="true"><Icon size={72} weight="duotone"/></div>;
}
