/**
 * Options for configuring a Task.
 */
import type { TaskInput } from "./TaskInput";
import type { TaskOutput } from "./TaskOutput";

export interface TaskOptions {
  /**
   * List of task IDs that must complete before this task runs.
   */
  deps?: string[];
  /**
   * The function to execute for this task.
   */
  executor: (params: TaskInput) => TaskOutput | Promise<TaskOutput>;
}
