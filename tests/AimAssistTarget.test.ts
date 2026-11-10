import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calculateProjectileAimAngle,
  selectAimAssistTarget,
  type AimAssistSettings,
  type AimAssistTargetContext,
} from '../src/aim/AimAssistTarget';

function setup() {
  const values: Record<string, number | boolean> = {
    pin_locked_target: true,
    require_active_target: true,
    projectile_lead: true,
    min_distance: 150,
    min_range_ratio: 0.15,
    min_hit_window: 650,
    max_hit_window: 1200,
    max_lead_time: 2,
  };
  const settings: AimAssistSettings = {
    getAimAssistBoolean: (key) => Boolean(values[key.slice('aim_assist_'.length)]),
    getAimAssistNumber: (key) => Number(values[key.slice('aim_assist_'.length)]),
  };
  const ship = { get_pos: () => ({ x: 0, y: 0 }) };
  const target = {
    alive: true,
    get_isHostile: () => true,
    pos: { x: 200, y: 0 },
    speed: { x: 0, y: 100 },
  };
  const weapon = {
    projectileFunction: 'bullet',
    get_fire: () => true,
    get_isMissileWeapon: () => false,
    range: 1000,
    reloadTime: 400,
    speed: 200,
    ttl: 1500,
  };
  let contact: { unit: any; time: number } | undefined = { unit: target, time: 1000 };
  const context: AimAssistTargetContext = {
    current: target,
    locked: false,
    lastContact: () => contact,
    isPlayer: () => false,
    isTeleport: () => false,
    isBeam: () => false,
    isEnemyShip: () => false,
  };
  return {
    ship,
    target,
    weapon,
    settings,
    values,
    context,
    contact: (next: typeof contact) => {
      contact = next;
    },
    select: (now = 1500) => selectAimAssistTarget(ship, weapon, now, settings, context),
  };
}

test('aim eligibility requires actual contacts and preserves hit-age and distance boundaries', () => {
  const f = setup();
  assert.equal(f.select(1800).target, f.target, 'hit-window equality remains eligible');
  assert.equal(f.select(1801).reason, 'last simulated hit is too old');
  assert.equal(f.select(999).reason, 'simulated hit timestamp is in the future');
  f.weapon.reloadTime = 10;
  assert.equal(f.select(1650).hitWindow, 650);
  assert.equal(f.select(1651).target, null);
  f.weapon.reloadTime = 3000;
  assert.equal(f.select(2200).hitWindow, 1200);
  assert.equal(f.select(2201).target, null);
  f.target.pos.x = 150;
  assert.equal(f.select().target, f.target);
  f.target.pos.x = 149.99;
  assert.equal(f.select().target, null);
  f.target.pos.x = 200;
  f.weapon.range = 2000;
  assert.equal(f.select().minimumDistance, 300);
  assert.equal(f.select().target, null);
  f.contact(undefined);
  assert.equal(f.select().reason, 'waiting for a locally simulated weapon hit');
});

test('pinned NPCs bypass contact and active-target requirements but never weapon/player restrictions', () => {
  const f = setup();
  f.context.locked = true;
  f.contact(undefined);
  assert.equal(f.select().target, f.target);
  assert.equal(f.select().hitAge, -1);
  const restrictions = [
    () => {
      f.context.isTeleport = () => true;
    },
    () => {
      f.context.isBeam = () => true;
    },
    () => {
      f.weapon.get_isMissileWeapon = () => true;
    },
    () => {
      f.weapon.projectileFunction = '';
    },
    () => {
      f.weapon.get_fire = () => false;
    },
    () => {
      f.context.isPlayer = () => true;
    },
    () => {
      f.target.alive = false;
    },
    () => {
      f.target.get_isHostile = () => false;
    },
  ];
  for (const restrict of restrictions) {
    restrict();
    assert.equal(f.select().target, null);
    f.context.isTeleport = () => false;
    f.context.isBeam = () => false;
    f.weapon.get_isMissileWeapon = () => false;
    f.weapon.projectileFunction = 'bullet';
    f.weapon.get_fire = () => true;
    f.context.isPlayer = () => false;
    f.target.alive = true;
    f.target.get_isHostile = () => true;
  }
  f.values.pin_locked_target = false;
  assert.equal(f.select().target, null);
});

test('non-pinned assist respects active target identity without changing selection or gameplay', () => {
  const f = setup();
  const before = JSON.stringify(f.target);
  f.context.current = null;
  assert.equal(f.select().reason, 'there is no active target-system target');
  f.context.current = { ...f.target };
  assert.equal(f.select().reason, 'simulated hit does not match the active target');
  f.values.require_active_target = false;
  assert.equal(f.select().target, f.target);
  assert.notEqual(f.context.current, f.target);
  assert.equal(JSON.stringify(f.target), before);
  assert.equal(selectAimAssistTarget(null, f.weapon, 1500, f.settings, f.context).target, null);
  assert.equal(selectAimAssistTarget(f.ship, null, 1500, f.settings, f.context).target, null);
});

test('projectile lead uses orbit velocity, caps by TTL/settings, and falls back at insufficient closing speed', () => {
  const f = setup();
  const angle = () =>
    calculateProjectileAimAngle(f.ship, f.weapon, f.target, f.settings, f.context.isEnemyShip);
  assert.equal(angle(), Math.atan2(100, 200));
  f.weapon.ttl = 500;
  assert.equal(angle(), Math.atan2(50, 200));
  f.weapon.ttl = 0;
  f.values.max_lead_time = 0.25;
  assert.equal(angle(), Math.atan2(25, 200));
  f.values.max_lead_time = 2;
  f.target.speed.x = 199;
  assert.equal(angle(), 0, 'closing speed of one falls back to direct aim');
  f.target.speed.x = 250;
  assert.equal(angle(), 0);
  f.target.speed.x = 0;
  Object.assign(f.target, {
    stateMachine: { inState: (name: string) => name === 'AIOrbit' },
    calculateOrbitSpeed: () => ({ x: 0, y: -100 }),
  });
  f.context.isEnemyShip = () => true;
  assert.equal(angle(), Math.atan2(-100, 200));
  f.values.projectile_lead = false;
  assert.equal(angle(), 0);
  f.values.projectile_lead = true;
  f.weapon.speed = 0;
  assert.equal(angle(), 0);
  f.weapon.speed = 200;
  f.target.pos.x = 0;
  assert.equal(angle(), 0);
});
