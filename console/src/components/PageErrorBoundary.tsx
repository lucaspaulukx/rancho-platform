import { Component, type ReactNode } from 'react';
import { useRouteError } from 'react-router-dom';
import { Button, Empty } from './ui';
import { useI18n } from '../i18n/provider';

export function isModuleLoadError(error: unknown) {
  return (
    error instanceof Error &&
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed|Unable to preload CSS/i.test(
      error.message,
    )
  );
}
export function PageRecovery({ error }: { error: unknown }) {
  const { t } = useI18n();
  return (
    <Empty
      title={isModuleLoadError(error) ? t('recovery.moduleTitle') : t('recovery.renderTitle')}
      description={
        isModuleLoadError(error) ? t('recovery.moduleDescription') : t('recovery.renderDescription')
      }
      action={<Button onClick={() => window.location.reload()}>{t('recovery.reload')}</Button>}
    />
  );
}
export class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? <PageRecovery error={this.state.error} /> : this.props.children;
  }
}
export function RouteRecovery() {
  return <PageRecovery error={useRouteError()} />;
}
