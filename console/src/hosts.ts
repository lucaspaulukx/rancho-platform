import type { Resource } from './api';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function hostSummary(host: Resource) {
  const info = record(host.info);
  const cpu = record(info.cpuInfo);
  const memory = record(info.memoryInfo);
  const os = record(info.osInfo);
  const number = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
  const total = number(memory.memTotal);
  return {
    cpu: number(cpu.count),
    // Rancher 1.6 memoryInfo.memTotal is MiB (native host model uses formatMib).
    memoryGiB: total === undefined ? undefined : total / 1024,
    os: typeof os.operatingSystem === 'string' ? os.operatingSystem : undefined,
    docker: typeof os.dockerVersion === 'string' ? os.dockerVersion : undefined,
    address: typeof host.agentIpAddress === 'string' ? host.agentIpAddress : undefined,
  };
}
export function containersOnHost(host: Resource, containers: Resource[]) {
  // hostId is authoritative; removed containers remain out of the live inventory.
  return containers.filter(
    (container) =>
      container.hostId === host.id &&
      !container.removed &&
      !['removed', 'purged'].includes(container.state || ''),
  );
}
