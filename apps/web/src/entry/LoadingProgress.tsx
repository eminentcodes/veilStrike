import './loading-progress.css';

export function LoadingProgress({ value, label = 'LOADING' }: { value: number; label?: string }) {
  const percent = Math.max(0, Math.min(100, Math.floor(value)));
  return <div className="loading-progress" data-progress={percent}>
    <div className="loading-progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <span style={{ width: percent + '%' }}/>
    </div>
    <div className="loading-progress-label"><span>{label}</span><strong>{percent}%</strong></div>
  </div>;
}
