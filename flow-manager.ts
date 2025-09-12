export type TaskContext = Record<string, any>;

export interface TaskInput {
  context: TaskContext;
}

export type TaskOutput = Record<string, any>;

export interface TaskOptions {
  deps?: string[];
  executor: (params: TaskInput) => TaskOutput | Promise<TaskOutput>;
}

export interface FlowManagerOptions {
  /**
   * Timeout in milliseconds for each task (default: 30000 ms)
   */
  timeout?: number;
  debug?: boolean;
}

const DEFAULT_FLOW_MANAGER_OPTIONS: FlowManagerOptions = {
  timeout: 30000,
  debug: false,
};

export class Task {
  public readonly id;
  public readonly options: TaskOptions;

  constructor(id: string, options: TaskOptions) {
    this.id = id;
    this.options = options;
  }

  async exec(input: TaskInput): Promise<TaskOutput> {
    const response = this.options.executor(input);
    return response instanceof Promise ? await response : response;
  }
}

export class FlowManager {
  public readonly id: string;
  private taskList: Task[] = [];
  private options: FlowManagerOptions;

  constructor(id: string, options: FlowManagerOptions = {}) {
    this.id = id;
    this.options = {
      ...DEFAULT_FLOW_MANAGER_OPTIONS,
      ...options,
    };
  }

  public addTask(task: Task | string, taskOptions?: TaskOptions) {
    if (typeof task === "string" && taskOptions) {
      this.taskList.push(new Task(task, taskOptions));
    } else if (task instanceof Task) {
      this.taskList.push(task);
    } else {
      throw new Error("Invalid task or missing task options");
    }
    return this;
  }

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

  private debug(...args: any[]) {
    if (this.options.debug) console.debug(`[${this.id}] `, ...args);
  }
}
