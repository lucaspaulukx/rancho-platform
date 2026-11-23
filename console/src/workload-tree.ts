import type { Resource } from './api';
import {
  imageName,
  isInfrastructure,
  serviceIds,
  stackContents,
  type WorkloadInventory,
} from './workloads';

export interface ServiceNode {
  resource: Resource;
  containers: Resource[];
}
export interface StackNode {
  resource: Resource;
  services: ServiceNode[];
  containers: Resource[];
}
export interface WorkloadTree {
  stacks: StackNode[];
  services: ServiceNode[];
  containers: Resource[];
}
export interface WorkloadFilter {
  query: string;
  state: string;
  includeSystem: boolean;
}

/** Project resource relationships before filtering so hidden infrastructure never
 * leaks into the standalone group and matching containers retain their parents. */
export function workloadTree(inventory: WorkloadInventory, filter: WorkloadFilter): WorkloadTree {
  const query = filter.query.trim().toLocaleLowerCase();
  const queryMatches = (r: Resource) =>
    !query ||
    `${r.name || ''} ${r.id} ${r.description || ''} ${imageName(r)}`
      .toLocaleLowerCase()
      .includes(query);
  const matches = (r: Resource, inherited = false) =>
    (filter.includeSystem || !isInfrastructure(r)) &&
    (inherited || queryMatches(r)) &&
    (!filter.state || r.state === filter.state);
  const containersByService = new Map<string, Resource[]>();
  for (const container of inventory.containers) {
    for (const id of new Set(serviceIds(container))) {
      const containers = containersByService.get(id);
      if (containers) containers.push(container);
      else containersByService.set(id, [container]);
    }
  }
  const attachedServices = new Set<string>();
  const attachedContainers = new Set<string>();
  const projectService = (service: Resource, inherited = false): ServiceNode | undefined => {
    const containers = containersByService.get(service.id) ?? [];
    containers.forEach((container) => attachedContainers.add(container.id));
    const serviceMatchesQuery = inherited || queryMatches(service);
    const filtered = containers.filter((container) => matches(container, serviceMatchesQuery));
    return (filter.includeSystem || !isInfrastructure(service)) &&
      ((serviceMatchesQuery && matches(service, true)) || filtered.length)
      ? { resource: service, containers: filtered }
      : undefined;
  };
  const stacks: StackNode[] = [];
  for (const stack of inventory.stacks) {
    const contents = stackContents(stack, inventory);
    contents.services.forEach((service) => attachedServices.add(service.id));
    contents.containers.forEach((container) => attachedContainers.add(container.id));
    const stackMatchesQuery = queryMatches(stack);
    // Traverse hidden stacks as well to preserve ownership of their children.
    const nodes = contents.services
      .map((service) => projectService(service, stackMatchesQuery))
      .filter((node): node is ServiceNode => !!node);
    const serviceContainerIds = new Set<string>();
    for (const service of contents.services) {
      // Stack contents include every container linked to one of its services.
      for (const container of containersByService.get(service.id) ?? []) {
        serviceContainerIds.add(container.id);
      }
    }
    const containers = contents.containers.filter(
      (container) =>
        !serviceContainerIds.has(container.id) && matches(container, stackMatchesQuery),
    );
    if (
      (filter.includeSystem || !isInfrastructure(stack)) &&
      ((stackMatchesQuery && matches(stack, true)) || nodes.length || containers.length)
    )
      stacks.push({ resource: stack, services: nodes, containers });
  }
  const services = inventory.services
    .filter((service) => !attachedServices.has(service.id))
    .map((service) => projectService(service))
    .filter((node): node is ServiceNode => !!node);
  const containers = inventory.containers.filter(
    (container) => !attachedContainers.has(container.id) && matches(container),
  );
  return { stacks, services, containers };
}
