/**
 * The input provided to a task executor.
 */
import type { TaskContext } from "./TaskContext";

export interface TaskInput {
  /**
   * The context object shared between tasks.
   */
  context: TaskContext;
}
