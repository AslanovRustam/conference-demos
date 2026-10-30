export class IdleTimer {
  private last: number;

  constructor(
    private readonly timeoutMs: number,
    private readonly now: () => number,
  ) {
    this.last = now();
  }

  poke(): void {
    this.last = this.now();
  }

  isIdle(): boolean {
    return this.now() - this.last >= this.timeoutMs;
  }
}
