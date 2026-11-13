/** A pooled object is a new radar contact after reset, even at the same address. */
export class RadarIdentity<Owner extends object> {
  private readonly contacts = new WeakMap<object, { owner: Owner; generation: number }>();
  constructor(
    private readonly generation: (owner: Owner) => number,
    private readonly isCurrent: (owner: Owner) => boolean,
  ) {}
  capture(contact: object, owner: Owner): void {
    if (!this.contacts.has(contact))
      this.contacts.set(contact, { owner, generation: this.generation(owner) });
  }
  owns(contact: object, owner: Owner): boolean {
    const saved = this.contacts.get(contact);
    return (
      !!saved &&
      saved.owner === owner &&
      saved.generation === this.generation(owner) &&
      this.isCurrent(owner)
    );
  }
}
