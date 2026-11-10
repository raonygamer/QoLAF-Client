/** Message-time snapshot, retained when the friend leaves the room or goes offline. */
export class ChatFriendPingData {
  beginIndex = 0;
  endIndex = 0;
  playerId = '';
  name = '';
  skin = '';
  level = 0;
  clanName = '';
  solarSystem = '';
  solarSystemKey = '';
  room = '';
  systemType = '';
  shipHue = 0;
  shipBrightness = 0;
  shipSaturation = 0;
  shipContrast = 0;

  containsVisibleIndex(index: number): boolean {
    return index >= this.beginIndex && index < this.endIndex;
  }
}
