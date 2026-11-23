import { Component, type ReactNode } from 'react';
import { useRouteError } from 'react-router-dom';
import { Button, Empty } from './ui';

export function isModuleLoadError(error: unknown) {
  return (
    error instanceof Error &&
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed|Unable to preload CSS/i.test(
      error.message,
    )
  );
}
export function PageRecovery({ error }: { error: unknown }) {
  return (
    <Empty
      title={
        isModuleLoadError(error)
          ? 'Não foi possível carregar esta página'
          : 'Não foi possível abrir esta página'
      }
      description={
        isModuleLoadError(error)
          ? 'A console pode ter sido atualizada ou a conexão foi interrompida. Recarregue para buscar a versão atual. Alterações não salvas nesta aba podem ser perdidas.'
          : 'Ocorreu uma falha na interface. Você pode acessar outra seção ou recarregar esta página. Alterações não salvas nesta aba podem ser perdidas.'
      }
      action={<Button onClick={() => window.location.reload()}>Recarregar console</Button>}
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
