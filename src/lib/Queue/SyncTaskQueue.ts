import { TaskType } from "./Tasks";
import * as logger from "../Logger";

type QueueIdleListener = () => void;

export class SyncTaskQueue {
	private queue: TaskType[] = [];
	private locked: boolean = false;
	private onEmptyCallbacks: QueueIdleListener[] = [];

	isEmpty(): boolean {
		return this.queue.length <= 0 && !this.locked;
	}

	waitForEmpty(): Promise<void> {
		if (this.isEmpty()) {
			return Promise.resolve();
		}

		return new Promise((resolve: QueueIdleListener) => {
			this.onEmptyCallbacks.push(resolve);
		});
	}

	enqueue(task: TaskType): void {
		this.queue.push(task);
		void this.dequeue();
	}

	async dequeue(): Promise<void> {
		if (this.locked) {
			return;
		}

		if (this.queue.length === 0) {
			this.onEmptyCallbacks.forEach((resolve: QueueIdleListener) => resolve());
			this.onEmptyCallbacks = [];

			return;
		}

		this.locked = true;

		const task: TaskType | undefined = this.queue.shift();

		if (task !== undefined) {
			try {
				if (task?.kind == 'async') {
					await task?.execute();
				} else {
					task?.execute();
				}
			} catch (e) {
				if (e instanceof Error) {
					logger.error("Task failed with error", { message: e.message });
				} else {
					logger.error("Task failed", { error: e });
				}
			}
		}

		this.locked = false;
		void this.dequeue();
	}
}

