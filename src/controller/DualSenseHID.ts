import { encodeDualSenseReport, type DualSenseOutput } from './DualSenseReport';

interface HIDCollection {
  usagePage: number;
  usage: number;
  outputReports: readonly { reportId: number }[];
  children: readonly HIDCollection[];
}

export interface ControllerHIDDevice {
  vendorId: number;
  productId: number;
  productName: string;
  opened: boolean;
  collections: readonly HIDCollection[];
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(id: number, data: Uint8Array<ArrayBuffer>): Promise<void>;
}

export interface ControllerHID {
  requestDevice(options: {
    filters: { vendorId: number; productId: number; usagePage: number; usage: number }[];
  }): Promise<ControllerHIDDevice[]>;
}

export function browserHID(): ControllerHID | undefined {
  return (navigator as Navigator & { hid?: ControllerHID }).hid;
}

const neutral: DualSenseOutput = {
  left: { kind: 'off' },
  right: { kind: 'off' },
  weak: 0,
  strong: 0,
  releaseLights: true,
  population: 0,
};

/** Serialize writes and coalesce stale feedback so a slow Bluetooth link cannot build a backlog. */
export class DualSenseHID {
  private device: ControllerHIDDevice | null = null;
  private bluetooth = false;
  private sequence = 0;
  private pending: DualSenseOutput | null = null;
  private writing: Promise<void> | null = null;
  private lastBytes = '';
  private disposed = false;
  private connecting = false;
  private failed = false;
  status = 'Not connected';

  constructor(private readonly reportError: (error: unknown) => void) {}

  get connected(): boolean {
    return !this.failed && (this.device?.opened ?? false);
  }

  async connect(hid: ControllerHID | undefined = browserHID()): Promise<void> {
    if (this.disposed || this.connecting) return;
    if (!hid) {
      this.status = 'WebHID unavailable — standard controller input still works';
      return;
    }
    this.connecting = true;
    try {
      // Invoke the picker before any await: native button clicks provide user activation.
      const selection = hid.requestDevice({
        filters: [0x0ce6, 0x0df2].map((productId) => ({
          vendorId: 0x054c,
          productId,
          usagePage: 1,
          usage: 5,
        })),
      });
      const [device] = await selection;
      if (!device || this.disposed) return;
      await this.disconnect();
      if (this.disposed) return;
      const reports = device.collections.flatMap((collection) => outputReports(collection));
      const bluetooth = reports.includes(0x31);
      if (!bluetooth && !reports.includes(0x02))
        throw new Error('Unsupported DualSense output interface');
      if (!device.opened) await device.open();
      if (this.disposed) {
        await device.close();
        return;
      }
      this.device = device;
      this.failed = false;
      this.bluetooth = bluetooth;
      this.lastBytes = '';
      this.status = `${device.productName} (${bluetooth ? 'Bluetooth' : 'USB'})`;
    } catch (error) {
      this.status = error instanceof Error ? error.message : String(error);
      this.reportError(error);
    } finally {
      this.connecting = false;
    }
  }

  update(output: DualSenseOutput): void {
    if (!this.connected || this.disposed) return;
    this.pending = output;
    this.startWriter();
  }

  async reset(): Promise<void> {
    if (!this.device) return;
    this.pending = neutral;
    this.lastBytes = '';
    this.startWriter();
    await this.writing;
  }

  async disconnect(): Promise<void> {
    const device = this.device;
    if (!device) return;
    await this.reset();
    this.device = null;
    this.pending = null;
    this.lastBytes = '';
    try {
      if (device.opened) await device.close();
    } catch (error) {
      this.reportError(error);
    }
    this.status = 'Not connected';
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.disconnect();
  }

  private startWriter(): void {
    if (this.writing) return;
    this.writing = this.write().finally(() => {
      this.writing = null;
      if (this.pending && this.device) this.startWriter();
    });
  }

  private async write(): Promise<void> {
    while (this.pending && this.device) {
      const output = this.pending;
      this.pending = null;
      const signature = Array.from(encodeDualSenseReport(output, false).data).join(',');
      if (signature === this.lastBytes) continue;
      const report = encodeDualSenseReport(output, this.bluetooth, this.sequence++);
      try {
        await this.device.sendReport(report.id, report.data);
        this.lastBytes = signature;
      } catch (error) {
        this.pending = null;
        this.failed = true;
        this.status = 'Controller output disconnected';
        this.reportError(error);
        break;
      }
    }
  }
}

function outputReports(collection: HIDCollection): number[] {
  return [
    ...collection.outputReports.map((report) => report.reportId),
    ...collection.children.flatMap(outputReports),
  ];
}
