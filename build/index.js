// @bun
// src/task.ts
class Task {
  id;
  options;
  constructor(id, options) {
    this.id = id;
    this.options = options;
  }
  async exec(input) {
    const response = this.options.executor(input);
    return response instanceof Promise ? await response : response;
  }
}

// src/flow-manager.ts
var DEFAULT_FLOW_MANAGER_OPTIONS = {
  timeout: 30000,
  debug: false
};

class FlowManager {
  id;
  taskList = [];
  options;
  constructor(id, options = {}) {
    this.id = id;
    this.options = {
      ...DEFAULT_FLOW_MANAGER_OPTIONS,
      ...options
    };
  }
  addTask(task, taskOptions) {
    if (typeof task === "string" && taskOptions) {
      this.taskList.push(new Task(task, taskOptions));
    } else if (task instanceof Task) {
      this.taskList.push(task);
    } else {
      throw new Error("Invalid task or missing task options");
    }
    return this;
  }
  async run(initialContext = { context: {} }) {
    let taskProm = {};
    let context = initialContext.context;
    this.detectCircularDependencys();
    this.taskList.forEach(async (task) => {
      const { resolve, promise, reject } = Promise.withResolvers();
      const timeout = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out`));
      }, this.options.timeout);
      taskProm[task.id] = promise;
      this.debug(`Starting task: ${task.id}`);
      if (task.options.deps) {
        let depsPromArray = [];
        for (const dep of task.options.deps) {
          const depTask = taskProm[dep];
          if (!depTask) {
            this.debug(`	[${task.id}] Waiting for dependency:`, dep);
            taskProm[task.id] = depTask;
          }
        }
        await Promise.allSettled(depsPromArray);
        this.debug(`	[${task.id}] All dependencies resolved:`, task.options.deps);
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
        clearTimeout(timeout);
      }
      context[task.id] = response;
      Object.freeze(context[task.id]);
      this.debug(`Task executed: ${task.id}`, response);
      resolve(response);
    });
    this.debug("Finishing flow, waiting for all tasks to complete...");
    const ret = await Promise.allSettled(Object.values(taskProm));
    this.debug("All tasks completed.");
    if (ret.every((r) => r.status === "fulfilled")) {
      this.debug("Flow completed successfully.");
    } else {
      const errors = ret.filter((r) => r.status === "rejected").map((r) => r.reason);
      this.debug("Flow completed with errors.", errors);
      throw new Error(`Flow failed with errors: ${errors.join(", ")}`);
    }
    return context;
  }
  detectCircularDependencys() {
    const visited = new Set;
    const recStack = new Set;
    const taskMap = new Map;
    for (const task of this.taskList) {
      taskMap.set(task.id, task);
    }
    const hasCycle = (taskId) => {
      if (!visited.has(taskId)) {
        visited.add(taskId);
        recStack.add(taskId);
        const task = taskMap.get(taskId);
        if (task && task.options.deps) {
          for (const dep of task.options.deps) {
            if (!taskMap.has(dep)) {
              throw new Error(`Task dependency "${dep}" not found for task "${taskId}"`);
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
        throw new Error(`Circular dependency detected involving task "${task.id}"`);
      }
    }
  }
  debug(...args) {
    if (this.options.debug)
      console.debug(`[${this.id}] `, ...args);
  }
}
export {
  Task,
  FlowManager
};
