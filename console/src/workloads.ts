import type { Resource } from './api';

export interface WorkloadInventory {
  stacks: Resource[];
  services: Resource[];
  containers: Resource[];
}
export function activeResources(resources: Resource[]) {
  return resources.filter(
    (resource) => !resource.removed && resource.state !== 'removed' && resource.state !== 'purged',
  );
}
export function isInfrastructure(resource: Resource) {
  const labels = resource.labels as Record<string, unknown> | null | undefined;
  return !!resource.system || !!labels?.['io.rancher.container.system'];
}
export function serviceIds(container: Resource): string[] {
  return Array.isArray(container.serviceIds)
    ? container.serviceIds.filter((id): id is string => typeof id === 'string')
    : [];
}
export function containersForService(service: Resource, containers: Resource[]) {
  return containers.filter((container) => serviceIds(container).includes(service.id));
}
export function stackContents(stack: Resource, inventory: WorkloadInventory) {
  const declaredIds = Array.isArray(stack.serviceIds) ? stack.serviceIds : [];
  const services = inventory.services.filter(
    (service) => service.stackId === stack.id || declaredIds.includes(service.id),
  );
  const ids = new Set(services.map((service) => service.id));
  const containers = inventory.containers.filter(
    (container) =>
      container.stackId === stack.id || serviceIds(container).some((id) => ids.has(id)),
  );
  return { services, containers };
}
export function containerStack(container: Resource, inventory: WorkloadInventory) {
  const service = inventory.services.find((service) => serviceIds(container).includes(service.id));
  return inventory.stacks.find(
    (stack) => stack.id === container.stackId || stack.id === service?.stackId,
  );
}
export function imageName(resource: Resource) {
  const launch = resource.launchConfig as Record<string, unknown> | undefined;
  const image = resource.imageUuid || launch?.imageUuid;
  return typeof image === 'string' ? image.replace(/^docker:/, '') : '—';
}
