import { useApp } from '../state';

export function Brand({ compact = false }: { compact?: boolean; inverse?: boolean }) {
  const { config } = useApp();
  return (
    <div className={`brand ${compact ? 'compact' : ''}`}>
      <div className="product-brand">
        <span className="rancher-symbol">
          <img src="/console/brand/rancher-symbol.svg" alt="" />
        </span>
        <img className="rancher-wordmark" src="/console/brand/rancher-wordmark.svg" alt="Rancher" />
      </div>
      {config.branding && <span className="community-signature">Community Console</span>}
    </div>
  );
}
