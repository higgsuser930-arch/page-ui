/** SYNCORA logo: play-icon + wordmark (header), or the full logo with the orbit swoosh (landing). */
export function Logo({ size = 28, variant = 'compact' }: { size?: number; variant?: 'compact' | 'icon' | 'full' }) {
  if (variant === 'full') return <img className="logo-full" src="/syncora-logo.png" alt="SYNCORA" />;
  return (
    <span className="logo" aria-label="SYNCORA">
      <img src="/syncora-icon.png" alt="" width={size * 1.25} height={size * 1.25} />
      {variant === 'compact' && <img src="/syncora-wordmark.png" alt="SYNCORA" height={size * 0.62} className="logo-word" />}
    </span>
  );
}
