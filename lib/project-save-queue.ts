export type SaveResult =
  | { ok: true; updatedAt: string; expiresAt?: string | null }
  | { ok: false; reason: "conflict" | "error"; message: string };

export const SAVE_CONFLICT_MESSAGE =
  "Расчёт изменён в другой вкладке или другим участником. Ваши правки не перезаписали новые данные. Скачайте копию своих правок и обновите страницу.";

/** Coalesces pending snapshots and sends one request at a time. A failure
 * pauses the queue: a newer snapshot must not blindly overwrite the server. */
export class ProjectSaveQueue<T> {
  private pending: { value: T } | null = null;
  private running = false;
  private paused = false;

  constructor(
    private version: string,
    private save: (value: T, version: string) => Promise<SaveResult>,
    private onResult: (result: SaveResult, hasPending: boolean) => void,
  ) {}

  enqueue(value: T) {
    this.pending = { value };
    void this.drain();
  }

  retry() {
    this.paused = false;
    void this.drain();
  }

  private async drain() {
    if (this.running || this.paused) return;
    this.running = true;
    try {
      while (this.pending && !this.paused) {
        const snapshot = this.pending;
        this.pending = null;
        let result: SaveResult;
        try {
          result = await this.save(snapshot.value, this.version);
        } catch {
          result = { ok: false, reason: "error", message: "Не удалось сохранить. Проверьте соединение и повторите попытку." };
        }
        if (result.ok) {
          this.version = result.updatedAt;
        } else {
          this.paused = true;
          this.pending ??= snapshot;
        }
        this.onResult(result, this.pending !== null);
      }
    } finally {
      this.running = false;
    }
  }
}
