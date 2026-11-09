import { describe, expect, it } from 'vitest';
import type { Resource } from '../api';
import type { ServiceNode, StackNode, WorkloadTree } from '../workload-tree';
import { workloadTreePage } from '../workload-tree-page';

const resource = (id: string, type = 'container'): Resource => ({ id, type, links: {} });
const shared = resource('shared');
const web: ServiceNode = {
  resource: resource('web', 'service'),
  containers: [resource('web-first'), shared, resource('web-last')],
};
const worker: ServiceNode = { resource: resource('worker', 'service'), containers: [shared] };
const stack: StackNode = {
  resource: resource('stack', 'stack'),
  services: [web, worker],
  containers: [resource('direct')],
};
const nextStack: StackNode = {
  resource: resource('next-stack', 'stack'),
  services: [],
  containers: [resource('next-direct')],
};
const orphan: ServiceNode = {
  resource: resource('orphan', 'service'),
  containers: [shared, resource('orphan-last')],
};
const tree: WorkloadTree = {
  stacks: [stack, nextStack],
  services: [orphan],
  containers: [resource('standalone')],
};
const expanded = { stackExpanded: () => true, serviceExpanded: () => true };

describe('workloadTreePage', () => {
  it('windows rows across groups and repeats ancestors only where their children appear', () => {
    const pages = Array.from({ length: 5 }, (_, page) =>
      workloadTreePage(tree, { ...expanded, page, pageSize: 3 }),
    );
    expect(pages.map(({ total, current }) => [total, current])).toEqual([
      [14, 0],
      [14, 1],
      [14, 2],
      [14, 3],
      [14, 4],
    ]);
    expect(
      pages.map(({ stacks, services, containers }) => ({ stacks, services, containers })),
    ).toEqual([
      {
        stacks: [
          {
            node: stack,
            services: [{ node: web, containers: [web.containers[0]] }],
            containers: [],
          },
        ],
        services: [],
        containers: [],
      },
      {
        stacks: [
          {
            node: stack,
            services: [
              { node: web, containers: web.containers.slice(1) },
              { node: worker, containers: [] },
            ],
            containers: [],
          },
        ],
        services: [],
        containers: [],
      },
      {
        stacks: [
          {
            node: stack,
            services: [{ node: worker, containers: [shared] }],
            containers: stack.containers,
          },
          { node: nextStack, services: [], containers: [] },
        ],
        services: [],
        containers: [],
      },
      {
        stacks: [{ node: nextStack, services: [], containers: nextStack.containers }],
        services: [{ node: orphan, containers: [shared] }],
        containers: [],
      },
      {
        stacks: [],
        services: [{ node: orphan, containers: [orphan.containers[1]] }],
        containers: tree.containers,
      },
    ]);
    expect(pages[1].stacks[0].node).toBe(stack);
    expect(pages[1].stacks[0].services[0].node).toBe(web);
  });

  it('counts only visible rows and clamps the page after collapse', () => {
    const options = {
      stackExpanded: (node: StackNode) => node === nextStack,
      serviceExpanded: () => false,
      page: 4,
      pageSize: 2,
    };
    expect(workloadTreePage(tree, options)).toEqual({
      total: 5,
      current: 2,
      stacks: [],
      services: [],
      containers: tree.containers,
    });
    expect(workloadTreePage(tree, { ...options, page: 0 }).stacks).toEqual([
      { node: stack, services: [], containers: [] },
      { node: nextStack, services: [], containers: [] },
    ]);
  });

  it('keeps the expanded groups continuous when page size is omitted', () => {
    const page = workloadTreePage(tree, { ...expanded, page: 4 });
    expect(page).toEqual({
      total: 14,
      current: 0,
      stacks: [
        {
          node: stack,
          services: [
            { node: web, containers: web.containers },
            { node: worker, containers: worker.containers },
          ],
          containers: stack.containers,
        },
        { node: nextStack, services: [], containers: nextStack.containers },
      ],
      services: [{ node: orphan, containers: orphan.containers }],
      containers: tree.containers,
    });
    expect(page.stacks[0].services[0].containers).toBe(web.containers);
  });

  it('slices only the requested containers of a large service', () => {
    const containers = Array.from({ length: 2000 }, (_, index) => resource(String(index)));
    Object.defineProperty(containers, 0, {
      get: () => {
        throw new Error('Read a container outside the requested page');
      },
    });
    const service = { resource: web.resource, containers };
    const page = workloadTreePage(
      { stacks: [], services: [service], containers: [] },
      { ...expanded, page: 20, pageSize: 50 },
    );
    expect(page.total).toBe(2001);
    expect(page.services[0].node).toBe(service);
    expect(page.services[0].containers.map(({ id }) => id)).toEqual(
      Array.from({ length: 50 }, (_, index) => String(999 + index)),
    );
  });

  it('clamps empty trees to the first page', () => {
    const empty = { stacks: [], services: [], containers: [] };
    expect(workloadTreePage(empty, { ...expanded, page: 4, pageSize: 50 })).toEqual({
      ...empty,
      total: 0,
      current: 0,
    });
  });
});
