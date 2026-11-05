import type { Resource } from './api';
import {
  containersForService,
  imageName,
  isInfrastructure,
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
  const attachedServices = new Set<string>();
  const attachedContainers = new Set<string>();
  const projectService = (service: Resource, inherited = false): ServiceNode | undefined => {
    const containers = containersForService(service, inventory.containers);
    containers.forEach((container) => attachedContainers.add(container.id));
    const filtered = containers.filter((container) =>
      matches(container, inherited || queryMatches(service)),
    );
    return (filter.includeSystem || !isInfrastructure(service)) &&
      (matches(service, inherited) || filtered.length)
      ? { resource: service, containers: filtered }
      : undefined;
  };
  const stacks: StackNode[] = [];
  for (const stack of inventory.stacks) {
    const contents = stackContents(stack, inventory);
    contents.services.forEach((service) => attachedServices.add(service.id));
    contents.containers.forEach((container) => attachedContainers.add(container.id));
    // Traverse hidden stacks as well to preserve ownership of their children.
    const nodes = contents.services
      .map((service) => projectService(service, queryMatches(stack)))
      .filter((node): node is ServiceNode => !!node);
    const serviceContainerIds = new Set(
      contents.services.flatMap((service) =>
        containersForService(service, contents.containers).map((container) => container.id),
      ),
    );
    const containers = contents.containers.filter(
      (container) =>
        !serviceContainerIds.has(container.id) && matches(container, queryMatches(stack)),
    );
    if (
      (filter.includeSystem || !isInfrastructure(stack)) &&
      (matches(stack) || nodes.length || containers.length)
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
