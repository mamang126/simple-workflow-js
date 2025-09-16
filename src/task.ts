import type { TaskInput, TaskOptions, TaskOutput } from "./models";

/**
 * Represents a single unit of work in a flow.
 */
export class Task {
  /**
   * The unique identifier for the task.
   */
  public readonly id: string;
  /**
   * The options for the task, including dependencies and executor.
   */
  public readonly options: TaskOptions;

  /**
   * Create a new Task instance.
   * @param id - The unique task identifier.
   * @param options - The options for the task.
   */
  constructor(id: string, options: TaskOptions) {
    this.id = id;
    this.options = options;
  }

  /**
   * Execute the task's executor function.
   * @param input - The input context for the task.
   * @returns The output of the task.
   */
  async exec(input: TaskInput): Promise<TaskOutput> {
    const response = this.options.executor(input);
    return response instanceof Promise ? await response : response;
  }
}
