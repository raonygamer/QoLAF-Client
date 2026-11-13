import './Game';

/** Original client descriptor field; native Haxe room selection has no join-only flag. */
declare module './Game' {
  namespace Game.joinRoom {
    interface Room {
      joinOnly?: boolean;
    }
  }
}
