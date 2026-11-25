import { useApp } from '../state';

export function Brand({ compact = false }: { compact?: boolean; inverse?: boolean }) {
  const { config } = useApp();
  if (config.branding)
    return (
      <div className={`brand rancho-brand ${compact ? 'compact' : ''}`}>
        <div className="product-brand" role="img" aria-label="Rancho Platform">
          <img
            className="rancho-lockup"
            src="/console/brand/rancho-platform.png"
            alt=""
            width="2160"
            height="720"
          />
          <img
            className="rancho-icon"
            src="/console/brand/rancho-bull.png"
            alt=""
            width="1280"
            height="1280"
          />
        </div>
      </div>
    );
  return (
    <div className={`brand ${compact ? 'compact' : ''}`}>
      <div className="product-brand">
        <span className="rancher-symbol">
          <img src="/console/brand/rancher-symbol.svg" alt="" />
        </span>
        <img className="rancher-wordmark" src="/console/brand/rancher-wordmark.svg" alt="Rancher" />
      </div>
    </div>
  );
}
