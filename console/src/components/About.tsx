import { useI18n } from '../i18n/provider';
import { moduleNames } from '../config';
import { useApp } from '../state';
import { Brand } from './Brand';
import { Modal, Tabs, Alert } from './ui';
import { useState } from 'react';
import { version } from '../../package.json';
const serverFlags = [
  'API_KEY_STREAM_GUARD_ENABLED',
  'AUDIT_CREDENTIAL_REDACTION_ENABLED',
  'CUSTOMIZATION_ENABLED',
  'SCHEMA_MIGRATIONS_ENABLED',
  'LOCAL_RBAC_ENABLED',
  'NO_ACCESS_VIEW_ENABLED',
  'ENV_CREATION_ADMIN_ONLY',
  'DISABLE_AUTO_ENVIRONMENT',
  'SESSION_ACCOUNT_GUARD_ENABLED',
  'METRICS_PAYLOAD_TRANSPORT_ENABLED',
  'HOST_STREAM_SESSION_GUARD_ENABLED',
  'SUBSCRIPTION_SESSION_GUARD_ENABLED',
  'CATALOG_WRITE_GUARD_ENABLED',
  'OIDC_ENABLED',
  'OIDC_LOGIN_PREFLIGHT_ENABLED',
  'OIDC_FEDERATED_LOGOUT_ENABLED',
  'OIDC_ONLY',
  'OIDC_AUTO_LOGIN',
] as const;

export function About({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  function status(value: unknown) {
    return t(
      typeof value === 'boolean'
        ? value
          ? 'aboutPage.active'
          : 'aboutPage.inactive'
        : 'aboutPage.unknown',
    );
  }
  const app = useApp(),
    [tab, setTab] = useState(0);
  if (!app.config.modules.about) return null;
  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      title={t('aboutPage.title')}
      description={t('aboutPage.description')}
    >
      <Tabs
        labels={[t('aboutPage.product'), t('aboutPage.capabilities')]}
        selected={tab}
        onChange={setTab}
        idPrefix="about"
        panelId="about-panel"
        label={t('aboutPage.consoleInfo')}
      />
      <div id="about-panel" role="tabpanel" aria-labelledby={`about-${tab}`}>
        {tab === 0 ? (
          <>
            <div className="about-brand">
              <Brand />
            </div>
            <dl className="details-grid">
              <div>
                <dt>{t('aboutPage.modernConsole')}</dt>
                <dd>{version}</dd>
              </div>
              <div>
                <dt>{t('aboutPage.labBase')}</dt>
                <dd>Rancher 1.6.30</dd>
              </div>
            </dl>
            <p>{t('aboutPage.operations')}</p>
            <Alert tone="info">{t('aboutPage.migration')}</Alert>
            <p>{t('aboutPage.attribution')}</p>
            <div className="row-actions about-links">
              <a
                className="button secondary"
                href={app.config.classicUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t('aboutPage.classic')}
              </a>
              <a
                className="button secondary"
                href="/console/licenses/Inter-OFL.txt"
                target="_blank"
                rel="noreferrer"
              >
                {t('aboutPage.interLicense')}
              </a>
            </div>
          </>
        ) : (
          <>
            <Alert tone="info">{t('aboutPage.readOnly')}</Alert>
            <h3>{t('aboutPage.server')}</h3>
            <dl className="details-grid">
              {serverFlags.map((key) => (
                <div key={key}>
                  <dt>{t(`aboutPage.flag.${key}`)}</dt>
                  <dd>
                    {t('aboutPage.flagStatus', {
                      requested: status(app.server.requested?.[key]),
                      effective: status(app.server.effective[key]),
                      available: status(app.server.available[key]),
                    })}
                  </dd>
                </div>
              ))}
            </dl>
            <h3>{t('aboutPage.modules')}</h3>
            <dl className="details-grid">
              {moduleNames.map((name) => (
                <div key={name}>
                  <dt>{t(`aboutPage.module.${name}`)}</dt>
                  <dd>{status(app.config.modules[name])}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </Modal>
  );
}
