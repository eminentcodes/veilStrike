import { fightAudio } from '@/fight/audio';
import type { AudioLevels } from '@/fight/audio';

export function AudioSettings({ levels }: { levels: AudioLevels }) {
  return <div className="audio-sliders">{(['music','effects'] as const).map(key => <label key={key}>
      <span>{key === 'music' ? 'SOUND' : 'EFFECTS'}<strong>{Math.round(levels[key] * 100)}%</strong></span>
      <input aria-label={key === 'music' ? 'Sound volume' : 'Effects volume'} type="range" min="0" max="100" value={Math.round(levels[key] * 100)}
        onChange={event => fightAudio.setLevels({ [key]: Number(event.target.value) / 100 })}/>
    </label>)}</div>;
}
