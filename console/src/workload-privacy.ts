import type { Resource } from './api';

/** Stack parameters may contain passwords/PEM; editors fetch them into local state. */
export function publicWorkload(resource: Resource): Resource {
  if (resource.type !== 'stack') return resource;
  const {
    environment: _environment,
    answers: _answers,
    templates: _templates,
    dockerCompose: _dockerCompose,
    rancherCompose: _rancherCompose,
    ...metadata
  } = resource;
  return {
    ...metadata,
    hasComposeSource: typeof resource.dockerCompose === 'string' && !!resource.dockerCompose.trim(),
  };
}
