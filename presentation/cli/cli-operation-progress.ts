export class CliOperationProgress {
  private timer?: NodeJS.Timeout;
  private startedAt = Date.now();
  private stage = "";

  start(stage: string): void {
    this.startedAt = Date.now();
    this.update(stage);
    this.timer = setInterval(() => this.print("Still working: " + this.stage), 10_000);
    this.timer.unref();
  }

  update(stage: string): void {
    this.stage = stage;
    this.print(stage);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  private print(message: string): void {
    console.log(`[${Math.floor((Date.now() - this.startedAt) / 1000)}s] ${message}`);
  }
}
