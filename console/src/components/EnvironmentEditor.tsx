import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { allPages, type Resource, type Schema } from '../api';
import { useApp } from '../state';
import { Alert, ErrorState, Loading } from './ui';
import { SchemaForm } from './SchemaForm';
import { Link } from 'react-router-dom';
import { navigation } from '../navigation';

export function EnvironmentResources({ project }: { project: Resource }) {
  const app = useApp();
  const items = navigation.filter(
    (item) =>
      [
        '/stacks',
        '/services',
        '/containers',
        '/hosts',
        '/volumes',
        '/registries',
        '/secrets',
        '/certificates',
        '/catalog',
      ].includes(item.path) &&
      (!item.module || app.config.modules[item.module]),
  );
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <h2>Recursos deste environment</h2>
      <p className="muted">
        Abra uma área de operação no contexto de {project.name || project.id}.
      </p>
      <div className="related-links">
        {items.map((item) => (
          <Link
            className="button"
            key={item.path}
            to={`${item.path}?env=${encodeURIComponent(project.id)}`}
          >
            <item.icon size={16} />
            {item.title}
          </Link>
        ))}
      </div>
      {app.admin && app.config.modules.groups && (
        <p style={{ marginTop: 20, marginBottom: 0 }}>
          <Link to="/groups">Gerenciar acesso por grupos</Link>
        </p>
      )}
    </section>
  );
}

export function prepareEnvironmentTemplate(
  name: string,
  description: string,
  stacks: Record<string, unknown>[],
  isPublic?: boolean,
) {
  if (!name.trim() || name.trim().length > 255)
    throw new Error('Informe um nome de template com ate 255 caracteres.');
  if (description.length > 1024)
    throw new Error('A descricao do template deve ter ate 1024 caracteres.');
  if (!Array.isArray(stacks) || stacks.length > 100)
    throw new Error('O template deve conter no maximo 100 stacks.');
  const names = new Set<string>();
  for (const stack of stacks) {
    if (!stack || typeof stack !== 'object' || Array.isArray(stack))
      throw new Error('Uma stack do template e invalida.');
    const stackName = typeof stack.name === 'string' ? stack.name.trim() : '';
    if (stackName && names.has(stackName))
      throw new Error('Os nomes das stacks devem ser unicos no template.');
    if (stackName) names.add(stackName);
    const catalog = typeof stack.templateId === 'string' && !!stack.templateId.trim();
    const compose = typeof stack.dockerCompose === 'string' && !!stack.dockerCompose.trim();
    if (!catalog && !compose)
      throw new Error('Cada stack precisa de um template do catalogo ou Docker Compose.');
    if (
      stack.answers !== undefined &&
      (!stack.answers || typeof stack.answers !== 'object' || Array.isArray(stack.answers))
    )
      throw new Error('As respostas de uma stack sao invalidas.');
  }
  return {
    name: name.trim(),
    description: description.trim(),
    stacks: structuredClone(stacks),
    ...(isPublic === undefined ? {} : { isPublic }),
  };
}

export function environmentTemplateMetadata(value: Resource): Resource {
  return {
    id: value.id,
    type: value.type,
    name: value.name,
    description: value.description,
    state: value.state,
    links: {},
    stacks: Array.isArray(value.stacks)
      ? value.stacks.map((stack) => ({
          name: String(stack.name || ''),
          templateId: String(stack.templateId || ''),
          templateVersionId: String(stack.templateVersionId || ''),
        }))
      : [],
  };
}
export function EnvironmentEditor({
  schema,
  schemas,
  original,
  onSubmit,
  busy,
  error,
  onDirtyChange,
}: {
  schema: Schema;
  schemas: Record<string, Schema>;
  original?: Resource;
  onSubmit: (payload: Record<string, unknown>) => void;
  busy?: boolean;
  error?: Error | null;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const app = useApp();
  const [templateId, setTemplateId] = useState('');
  const templates = useQuery({
    queryKey: ['data', app.identity, 'environment-templates'],
    enabled: !original && !!schemas.projectTemplate?.links.collection,
    queryFn: async ({ signal }) =>
      (await allPages<Resource>(schemas.projectTemplate.links.collection, signal))
        .filter((template) => !template.removed && template.state === 'active')
        .map(environmentTemplateMetadata),
    staleTime: 30_000,
  });
  const template = templates.data?.find((value) => value.id === templateId);
  if (!original && templates.isPending && templates.fetchStatus !== 'idle')
    return <Loading label="Carregando templates do Rancher…" />;
  if (!original && templates.error)
    return <ErrorState error={templates.error} retry={() => void templates.refetch()} />;
  const editorSchema = {
    ...schema,
    resourceFields: {
      ...schema.resourceFields,
      name: { ...schema.resourceFields.name, required: true },
      projectTemplateId: {
        ...schema.resourceFields.projectTemplateId,
        description:
          'Selecione um template para provisionar a infraestrutura nativa, ou deixe vazio para não aplicar um template.',
      },
    },
  };
  return (
    <>
      <SchemaForm
        schema={editorSchema}
        schemas={schemas}
        original={original}
        references={{
          projectTemplate: templates.data || [],
          project: app.projects.map((value) => ({ ...value, type: 'project', links: {} })),
        }}
        onSubmit={onSubmit}
        busy={busy}
        error={error}
        onDirtyChange={onDirtyChange}
        onReferenceChange={(name, value) => {
          if (name === 'projectTemplateId') setTemplateId(value);
        }}
      />
      {!original && template && (
        <section
          className="panel"
          style={{ marginTop: 20 }}
          aria-label="Infraestrutura do template"
        >
          <h3>{template.name}</h3>
          <p className="muted">
            {template.description || 'Infraestrutura definida pelo template do Rancher.'}
          </p>
          <ul>
            {(
              template.stacks as { name: string; templateId: string; templateVersionId: string }[]
            ).map((stack, index) => (
              <li key={`${stack.templateId}-${index}`}>
                <strong>{stack.name || stack.templateId}</strong>
                <span className="muted"> · {stack.templateVersionId || stack.templateId}</span>
              </li>
            ))}
          </ul>
          <Alert tone="info">
            O Rancher provisionará estas stacks no novo environment. A execução depende dos hosts e
            dos serviços de infraestrutura disponíveis.
          </Alert>
        </section>
      )}
      {!original && (
        <p className="muted">
          O acesso por grupos pode ser configurado na tela Grupos após a criação.
        </p>
      )}
    </>
  );
}
