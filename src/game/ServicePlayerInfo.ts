/** Fields decoded by JoinRoomManager.onJoinedServiceRoom in wire order. */
export interface ServicePlayerInfo {
  key: string;
  level: number;
  split: string;
  musicVolume: number;
  effectVolume: number;
  xp: number;
  enemyKills: number;
  bossKills: number;
  suicides: number;
  troons: number;
  enemyEncounters: number;
  bossEncounters: number;
  exploredPlanets: number;
  systemType: string;
  currentRoom: string;
  currentRoomId: string;
  currentSolarSystem: string;
  clan: string;
}
