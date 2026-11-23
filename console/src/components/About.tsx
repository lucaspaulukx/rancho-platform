import { moduleNames, type ModuleName } from '../config';
import { useApp } from '../state';
import { Brand } from './Brand';
import { Modal, Tabs, Alert } from './ui';
import { useState } from 'react';
import { version } from '../../package.json';
const labels: Record<string, string> = {
  API_KEY_STREAM_GUARD_ENABLED: 'Revalidação de chaves de API em streams',
  AUDIT_CREDENTIAL_REDACTION_ENABLED: 'Proteção de credenciais na auditoria',
  CUSTOMIZATION_ENABLED: 'Customização da instância',
  SCHEMA_MIGRATIONS_ENABLED: 'Versionamento das tabelas da comunidade',
  LOCAL_RBAC_ENABLED: 'Grupos e RBAC local',
  NO_ACCESS_VIEW_ENABLED: 'Tela sem acesso',
  ENV_CREATION_ADMIN_ONLY: 'Criação de environments somente por administradores',
  DISABLE_AUTO_ENVIRONMENT: 'Bloqueio de environment pessoal automático',
  SESSION_ACCOUNT_GUARD_ENABLED: 'Sessão vinculada ao estado e perfil atuais da conta',
  METRICS_PAYLOAD_TRANSPORT_ENABLED: 'Negociação de métricas grandes por WebSocket',
  HOST_STREAM_SESSION_GUARD_ENABLED: 'Revalidação de sessões em logs, terminal e métricas',
  SUBSCRIPTION_SESSION_GUARD_ENABLED: 'Revalidação de sessões no subscribe WebSocket',
  CATALOG_WRITE_GUARD_ENABLED: 'Proteção de escrita nos catálogos por perfil',
  OIDC_ENABLED: 'Autenticação OIDC',
  OIDC_LOGIN_PREFLIGHT_ENABLED: 'Verificação prévia do provedor de login',
  OIDC_FEDERATED_LOGOUT_ENABLED: 'Saída federada opcional do provedor OIDC',
  OIDC_ONLY: 'Login exclusivo por OIDC',
  OIDC_AUTO_LOGIN: 'Entrada automática por OIDC',
};
const moduleLabels: Record<ModuleName, string> = {
  groups: 'Grupos',
  users: 'Usuários',
  localAccountAdministration: 'Administração de contas e credenciais locais',
  environments: 'Environments',
  networkPolicies: 'Políticas de rede',
  workloads: 'Workloads',
  contextActions: 'Operações contextuais',
  workloadUpgrades: 'Upgrade de imagem',
  workloadScaling: 'Escala de serviços',
  stackComposeUpgrades: 'Compose de stacks existentes',
  stackComposeEditor: 'Editor Compose',
  customCheckboxes: 'Checkboxes do tema',
  serviceLinksEditor: 'Vínculos de serviços',
  balancerRulesEditor: 'Regras de balanceadores',
  unsavedChangesGuard: 'Proteção de alterações pendentes',
  workloadCreationSections: 'Criação por seções',
  workloadBindingEditors: 'Portas e volumes estruturados',
  workloadHealthChecks: 'Verificações de saúde na criação',
  workloadHealthCheckUpgrades: 'Upgrade das verificações de saúde',
  workloadSidecars: 'Sidecars na criação de serviços',
  workloadSecurityUpgrades: 'Upgrade contextual de segurança',
  workloadSecurityEditors: 'Capabilities de segurança na criação',
  workloadResourceUpgrades: 'Upgrade contextual de memória, CPU e I/O',
  workloadResourceEditors: 'Editores de memória, CPU e I/O',
  workloadScheduling: 'Afinidades na criação de workloads',
  workloadSchedulingUpgrades: 'Upgrade contextual de afinidades',
  workloadSidecarUpgrades: 'Upgrade de sidecars',
  catalogUpgrades: 'Upgrade de catálogo',
  bulkActions: 'Operações em lote',
  hosts: 'Hosts',
  data: 'Dados e certificados',
  catalog: 'Catálogo',
  observability: 'Logs e terminal',
  metrics: 'Métricas',
  metricsPayloadTransport: 'Transporte negociado de métricas grandes',
  serviceMetrics: 'Métricas de containers no contexto do serviço',
  workloadUlimitEditors: 'Editor de limites de processo na criação',
  workloadUlimitUpgrades: 'Limites de processo no upgrade de serviço',
  workloadDeviceEditors: 'Editor de dispositivos na criação',
  workloadDeviceUpgrades: 'Dispositivos no upgrade de serviço',
  admin: 'Administração geral',
  api: 'Integrações adicionais',
  apiKeys: 'Chaves de API',
  audit: 'Auditoria',
  about: 'Sobre e capacidades',
  processes: 'Processos do engine',
  processReplay: 'Reexecução de processos',
  settings: 'Configurações do servidor',
  workloadConfigUpgrades: 'Upgrade de portas e volumes',
  webhooks: 'Webhooks nativos',
  catalogRepositories: 'Repositórios globais de catálogo',
  environmentCatalogs: 'Repositórios por environment',
  environmentCatalogDelegation: 'Delegação das fontes por environment',
  machineDrivers: 'Drivers de máquinas',
  driverActivation: 'Ativação de drivers',
  clusterMonitoring: 'Membros do cluster HA',
  processPools: 'Pools do engine',
  optional: 'Orquestradores opcionais',
};
function boolean(value: unknown) {
  return typeof value === 'boolean' ? (value ? 'Ativo' : 'Inativo') : 'Não informado';
}
export function About({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp(),
    [tab, setTab] = useState(0);
  if (!app.config.modules.about) return null;
  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      title="Sobre esta console"
      description="Rancher e capacidades da customização."
    >
      <Tabs
        labels={['Produto', 'Capacidades']}
        selected={tab}
        onChange={setTab}
        idPrefix="about"
        panelId="about-panel"
        label="Informações da console"
      />
      <div id="about-panel" role="tabpanel" aria-labelledby={`about-${tab}`}>
        {tab === 0 ? (
          <>
            <div className="about-brand">
              <Brand />
            </div>
            <dl className="details-grid">
              <div>
                <dt>Console moderna</dt>
                <dd>{version}</dd>
              </div>
              <div>
                <dt>Base do laboratório</dt>
                <dd>Rancher 1.6.30</dd>
              </div>
            </dl>
            <p>
              Operação de stacks, serviços e containers com acesso centralizado e autenticação OIDC.
              O Rancher mantém sua identidade e as regras de autorização do servidor.
            </p>
            <Alert tone="info">
              A migração está em andamento. Os módulos disponíveis dependem das flags e das
              permissões da sua conta. Funções ainda em validação permanecem desativadas.
            </Alert>
            <p>
              Esta console é uma customização independente. As marcas identificam os respectivos
              produtos e organizações; não indicam certificação ou endosso oficial do Rancher.
            </p>
            <div className="row-actions about-links">
              <a
                className="button secondary"
                href={app.config.classicUrl}
                target="_blank"
                rel="noreferrer"
              >
                Abrir Rancher clássico
              </a>
              <a
                className="button secondary"
                href="/console/licenses/Inter-OFL.txt"
                target="_blank"
                rel="noreferrer"
              >
                Licença da fonte Inter
              </a>
            </div>
          </>
        ) : (
          <>
            <Alert tone="info">
              Consulta somente leitura. Capacidades do servidor vêm da configuração da instância;
              flags da console vêm do arquivo de configuração. Alterar a aparência não altera
              permissões.
            </Alert>
            <h3>Servidor</h3>
            <dl className="details-grid">
              {Object.entries(labels).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    Solicitado: {boolean(app.server.requested?.[key])} · Efetivo:{' '}
                    {boolean(app.server.effective[key])} · Disponível:{' '}
                    {boolean(app.server.available[key])}
                  </dd>
                </div>
              ))}
            </dl>
            <h3>Módulos da console</h3>
            <dl className="details-grid">
              {moduleNames.map((name) => (
                <div key={name}>
                  <dt>{moduleLabels[name]}</dt>
                  <dd>{boolean(app.config.modules[name])}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </Modal>
  );
}
