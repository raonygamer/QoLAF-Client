import type { DiscordActivity } from './DiscordActivity';
import { boundActivityText } from './DiscordActivity';

export interface DiscordBridge {
  start(application: string): Promise<{ state: string }>;
  setActivity(
    activity: DiscordActivity & { timestamps: { start: number } },
  ): Promise<{ state: string }>;
  status(): Promise<{ state: string }>;
  stop(): Promise<{ state: string }>;
}
export interface DiscordPreferences {
  discordPresenceEnabled: boolean;
  discordPresenceApplicationId: string;
}
export const DISCORD_APPLICATION_ID = '1551018956079235112';
export const validApplicationId = (value: string): boolean => /^[0-9]{17,20}$/.test(value);

/** Root-plugin lifetime, independent of room transitions and owned by one native bridge. */
export class DiscordPresence {
  statusText = 'Disabled';
  private application = '';
  private lastActivity = '';
  private lastSample = -Infinity;
  private failures = 0;
  private nextAttempt = 0;
  private running = false;
  private busy = false;
  private disposed = false;
  private restart = false;
  private readonly sessionStart = Math.floor(Date.now() / 1000);

  constructor(
    private readonly bridge: DiscordBridge | undefined,
    private readonly preferences: () => DiscordPreferences | undefined,
    private readonly snapshot: () => DiscordActivity,
    private readonly now: () => number = () => performance.now(),
  ) {}

  reset(): void {
    this.failures = 0;
    this.nextAttempt = 0;
    this.restart = true;
  }

  async tick(): Promise<void> {
    if (this.disposed || this.busy) return;
    const settings = this.preferences();
    if (!settings) return;
    if (!this.bridge) {
      this.statusText = settings.discordPresenceEnabled ? 'Unavailable in this host' : 'Disabled';
      return;
    }
    this.busy = true;
    try {
      const application = settings.discordPresenceApplicationId || DISCORD_APPLICATION_ID;
      if (
        this.running &&
        (!settings.discordPresenceEnabled || application !== this.application || this.restart)
      ) {
        this.running = false;
        await this.bridge.stop();
        if (this.disposed) return;
      }
      this.restart = false;
      if (!settings.discordPresenceEnabled) {
        this.statusText = 'Disabled';
        this.failures = 0;
        return;
      }
      if (!validApplicationId(application)) {
        this.statusText = 'Set an application ID with /discordpresence app <ID>';
        return;
      }
      if (this.failures >= 3) {
        this.statusText = 'Helper failed; use /discordpresence on to retry';
        return;
      }
      if (this.now() < this.nextAttempt) return;
      if (!this.running) {
        this.application = application;
        this.running = true;
        const result = await this.bridge.start(application);
        if (this.disposed) return;
        this.acceptStatus(result.state);
        this.lastActivity = '';
        this.lastSample = -Infinity;
      } else {
        const result = await this.bridge.status();
        if (this.disposed) return;
        this.acceptStatus(result.state);
      }
      if (
        !settings.discordPresenceEnabled ||
        application !== (settings.discordPresenceApplicationId || DISCORD_APPLICATION_ID) ||
        this.restart
      )
        return;
      if (this.now() - this.lastSample < 5000) return;
      this.lastSample = this.now();
      const snapshot = this.snapshot();
      const activity = {
        details: boundActivityText(snapshot.details),
        state: boundActivityText(snapshot.state),
        timestamps: { start: this.sessionStart },
      };
      const serialized = JSON.stringify(activity);
      if (serialized !== this.lastActivity) {
        const result = await this.bridge.setActivity(activity);
        if (this.disposed) return;
        this.acceptStatus(result.state);
        this.lastActivity = serialized;
      }
    } catch {
      if (!this.disposed) {
        this.running = false;
        this.failures++;
        this.nextAttempt = this.now() + Math.min(30000, 1000 * 2 ** this.failures);
        this.statusText = 'Helper unavailable; retrying';
        await this.bridge.stop().catch(() => {});
      }
    } finally {
      this.busy = false;
    }
  }

  private acceptStatus(state: string): void {
    if (
      [
        'helper_failed',
        'helper_unresponsive',
        'discord_rejected_activity',
        'linux_helper_launch_failed',
        'linux_helper_missing',
        'invalid_application_id',
      ].includes(state)
    )
      throw new Error(state);
    this.statusText = state.replace(/_/g, ' ');
  }

  dispose(): void {
    this.disposed = true;
    if (this.running) void this.bridge?.stop().catch(() => {});
    this.running = false;
  }
}
