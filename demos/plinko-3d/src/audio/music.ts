export interface Music {
  start(): void;
  setIntensity(level: number, seconds: number): void;
  stop(): void;
}
