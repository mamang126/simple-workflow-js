import type {
  FlowManagerOptions,
  TaskOptions,
  TaskInput,
  TaskOutput,
  TaskContext,
} from "./models";
import { Task } from "./task";

const DEFAULT_FLOW_MANAGER_OPTIONS: Required<FlowManagerOptions> = {
  timeout: 30000,
  debug: false,
};

/**
 * Manages a sequence of tasks, their dependencies, and execution order.
 */
export class FlowManager {
  /**
   * The unique identifier for the flow.
   */
  public readonly id: string;
  /**
   * The list of tasks in the flow.
   */
  private taskList: Task[] = [];
  /**
   * The options for the flow manager.
   */
  private options: Required<FlowManagerOptions>;

  /**
   * Create a new FlowManager instance.
   * @param id - The unique flow identifier.
   * @param options - Optional configuration for the flow manager.
   */
  constructor(id: string, options: FlowManagerOptions = {}) {
    this.id = id;
    this.options = {
      ...DEFAULT_FLOW_MANAGER_OPTIONS,
      ...options,
    };
  }

  /**
   * Add a task to the flow. This method is polymorphic:
   *
   * - If called with a `Task` instance, it adds the task directly.
   * - If called with a `string` (task ID) and `taskOptions`, it creates and adds a new Task.
   *
   * @param task - Either a Task instance or a string representing the task ID.
   * @param taskOptions - The options for the task (required if task is a string).
   * @returns The FlowManager instance (for chaining).
   */
  public addTask(task: Task | string, taskOptions?: TaskOptions): this {
    if (typeof task === "string" && taskOptions) {
      this.taskList.push(new Task(task, taskOptions));
    } else if (task instanceof Task) {
      this.taskList.push(task);
    } else {
      throw new Error("Invalid task or missing task options");
    }
    return this;
  }

  /**
   * Run all tasks in the flow, respecting dependencies and context.
   * @param initialContext - The initial context for the flow.
   * @returns The final context after all tasks complete.
   * @throws If any task fails or a circular dependency is detected.
   */
  public async run(
    initialContext: TaskInput = { context: {} }
  ): Promise<TaskOutput> {
    let taskProm: Record<string, Promise<any>> = {};
    let context: TaskContext = initialContext.context;

    // Detect circular dependencies
    this.detectCircularDependencys();

    this.taskList.forEach(async (task) => {
      const { resolve, promise, reject } = Promise.withResolvers();

      // Set up the timeout
      const timeout = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out`));
      }, this.options.timeout);

      // Save the promise to the map
      taskProm[task.id] = promise;

      this.debug(`Starting task: ${task.id}`);

      //Check deps
      if (task.options.deps) {
        let depsPromArray: Promise<any>[] = [];
        for (const dep of task.options.deps) {
          const depTask = taskProm[dep];
          if (!depTask) {
            this.debug(`\t[${task.id}] Waiting for dependency:`, dep);
            taskProm[task.id] = depTask;
          }
        }
        await Promise.allSettled(depsPromArray);
        this.debug(
          `\t[${task.id}] All dependencies resolved:`,
          task.options.deps
        );
      }

      let response;
      try {
        response = await task.exec({ context });
      } catch (error) {
        if (error instanceof Error) {
          reject(new Error(`Task ${task.id} failed: ${error.message}`));
        } else {
          reject(new Error(`Task ${task.id} failed`));
        }
      } finally {
        clearTimeout(timeout); // Clear the timeout on success or failure
      }

      // Set context and freeze it to prevent modifications
      context[task.id] = response;
      Object.freeze(context[task.id]); // Freeze the task result to prevent modifications

      // Log and resolve
      this.debug(`Task executed: ${task.id}`, response);
      resolve(response);
    });

    this.debug("Finishing flow, waiting for all tasks to complete...");
    const ret = await Promise.allSettled(Object.values(taskProm));
    this.debug("All tasks completed.");

    // Check for any rejected tasks
    if (ret.every((r) => r.status === "fulfilled")) {
      this.debug("Flow completed successfully.");
    } else {
      const errors = ret
        .filter((r) => r.status === "rejected")
        .map((r) => (r as PromiseRejectedResult).reason);
      this.debug("Flow completed with errors.", errors);
      throw new Error(`Flow failed with errors: ${errors.join(", ")}`);
    }
    return context;
  }

  /**
   * Detect circular dependencies in the task list and throw an error if found.
   * @private
   */
  private detectCircularDependencys() {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const taskMap = new Map<string, Task>();
    for (const task of this.taskList) {
      taskMap.set(task.id, task);
    }

    const hasCycle = (taskId: string): boolean => {
      if (!visited.has(taskId)) {
        visited.add(taskId);
        recStack.add(taskId);

        const task = taskMap.get(taskId);
        if (task && task.options.deps) {
          for (const dep of task.options.deps) {
            if (!taskMap.has(dep)) {
              throw new Error(
                `Task dependency "${dep}" not found for task "${taskId}"`
              );
            }
            if (!visited.has(dep) && hasCycle(dep)) {
              return true;
            } else if (recStack.has(dep)) {
              return true;
            }
          }
        }
      }
      recStack.delete(taskId);
      return false;
    };

    for (const task of this.taskList) {
      if (hasCycle(task.id)) {
        throw new Error(
          `Circular dependency detected involving task "${task.id}"`
        );
      }
    }
  }

  /**
   * Print debug messages if debug mode is enabled.
   * @param args - Arguments to log.
   * @private
   */
  private debug(...args: unknown[]) {
    if (this.options.debug) console.debug(`[${this.id}] `, ...args);
  }
}
