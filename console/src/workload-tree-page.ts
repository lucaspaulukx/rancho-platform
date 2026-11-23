import type { Resource } from './api';
import type { ServiceNode, StackNode, WorkloadTree } from './workload-tree';

interface ServicePage {
  node: ServiceNode;
  containers: Resource[];
}

interface StackPage {
  node: StackNode;
  services: ServicePage[];
  containers: Resource[];
}

export function workloadTreePage(
  tree: WorkloadTree,
  options: {
    stackExpanded: (node: StackNode) => boolean;
    serviceExpanded: (node: ServiceNode) => boolean;
    page: number;
    pageSize?: number;
  },
) {
  const { stackExpanded, serviceExpanded, pageSize } = options;

  function readPage(current: number) {
    const start = pageSize === undefined ? 0 : current * pageSize;
    const end = pageSize === undefined ? Infinity : start + pageSize;
    let offset = 0;

    function readContainers(containers: Resource[]) {
      const first = Math.max(0, start - offset);
      const last = Math.min(containers.length, end - offset);
      offset += containers.length;
      if (first >= last) return [];
      return first === 0 && last === containers.length ? containers : containers.slice(first, last);
    }

    function readServices(nodes: ServiceNode[]) {
      const services: ServicePage[] = [];
      for (const node of nodes) {
        const heading = offset++;
        const containers = serviceExpanded(node) ? readContainers(node.containers) : [];
        // A heading is also needed when only its descendants intersect the page.
        if (heading < end && offset > start) services.push({ node, containers });
      }
      return services;
    }

    const stacks: StackPage[] = [];
    for (const node of tree.stacks) {
      const heading = offset++;
      const expanded = stackExpanded(node);
      const services = expanded ? readServices(node.services) : [];
      const containers = expanded ? readContainers(node.containers) : [];
      if (heading < end && offset > start) stacks.push({ node, services, containers });
    }
    const services = readServices(tree.services);
    const containers = readContainers(tree.containers);
    return { total: offset, current, stacks, services, containers };
  }

  if (pageSize === undefined) return readPage(0);
  const requested = readPage(Math.max(0, options.page));
  const lastPage = Math.max(0, Math.ceil(requested.total / pageSize) - 1);
  return requested.current > lastPage ? readPage(lastPage) : requested;
}
