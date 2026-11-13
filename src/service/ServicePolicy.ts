import type { JoinRoomManager } from '../game/Bindings';

export interface ServicePolicy {
  readonly visible: boolean;
  readonly createAllowed: boolean;
}

const policies = new WeakMap<JoinRoomManager, ServicePolicy>();
const defaultPolicy: ServicePolicy = Object.freeze({ visible: true, createAllowed: true });

export function servicePolicyFor(manager: JoinRoomManager): ServicePolicy {
  return policies.get(manager) ?? defaultPolicy;
}

export function setServicePolicy(manager: JoinRoomManager, policy: ServicePolicy): void {
  policies.set(manager, Object.freeze({ ...policy }));
}

export function resetServicePolicy(manager: JoinRoomManager): void {
  policies.delete(manager);
}
