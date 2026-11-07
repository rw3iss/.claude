import type { ApiClient } from "../services/api/ApiClient";

const DEFAULT_LATENCY_MS = 200;

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export class MockApiAdapter implements ApiClient {
  private latencyMs: number;
  constructor(latencyMs: number = DEFAULT_LATENCY_MS) {
    this.latencyMs = latencyMs;
  }
  protected async withLatency<T>(fn: () => T | Promise<T>): Promise<T> {
    await delay(this.latencyMs);
    return await fn();
  }
  // Claude adds concrete methods (getProducts, getUser, etc.) that read from
  // src/mock/data/*.json and return realistic fixtures.
}
