/** Flash getTimer semantics for local simulation, independent of the epoch clock. */
export class ElapsedClock {
  private readonly started: number;

  constructor(
    private readonly initialElapsed: number,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.started = now();
  }

  read(): number {
    return this.initialElapsed + this.now() - this.started;
  }
}
