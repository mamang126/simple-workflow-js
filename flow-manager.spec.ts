import { expect, test, describe, it } from "bun:test";
import { FlowManager, Task, type TaskOutput } from "./flow-manager";

describe("FlowManager", () => {
  describe("Definition", () => {
    it("Should run with regular tasks", async () => {
      const fm = new FlowManager("Main");
      const response = await fm
        .addTask("init", {
          executor: (input) => {
            return {
              value: 1,
            };
          },
        })
        .addTask("step1", {
          executor: (input) => {
            return {
              value: 2,
            };
          },
        })
        .run();
      expect(response["init"].value).toBe(1);
      expect(response["step1"].value).toBe(2);
    });

    it("Should throw if edit context of other tasks", async () => {
      const fm = new FlowManager("Main", {
        debug: true,
      });
      fm.addTask("init", {
        executor: (input) => {
          return {
            value: 1,
          };
        },
      });
      fm.addTask("step1", {
        deps: ["init"],
        executor: (input) => {
          // This should not be allowed
          input.context.init.value += 10;
          return {
            value: 2,
          };
        },
      });
      await expect(fm.run()).rejects.toThrow();
    });

    it("Should throww it timeout hits", async () => {
      const fm = new FlowManager("Main", {
        timeout: 1000,
        debug: true,
      });
      fm.addTask("init", {
        executor: (input) => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                value: 1,
              });
            }, 2000);
          });
        },
      });
      await expect(fm.run()).rejects.toThrow(/timed out/);
    });

    it("Should work with an advanced flow", async () => {
      const fm = new FlowManager("Main", {
        debug: true,
      })
        .addTask("task-01", {
          executor: (input) => {
            return new Promise((resolve) => {
              setTimeout(() => {
                input.context["task-01"] = 1;
                resolve({ value: true });
              }, 1000);
            });
          },
        })
        .addTask("task-02", {
          deps: ["task-01"],
          executor: (input) => {
            return new Promise((resolve) => {
              setTimeout(() => {
                input.context["task-02"] = input.context["task-01"] + 1;
                resolve({ value: true });
              }, 1000);
            });
          },
        })
        .addTask("task-03", {
          deps: ["task-02"],
          executor: (input) => {
            return new Promise((resolve) => {
              setTimeout(() => {
                input.context["task-03"] = input.context["task-02"] + 1;
                resolve({ value: true });
              }, 1000);
            });
          },
        })
        .addTask("task-04", {
          deps: ["task-01", "task-03"],
          executor: (input) => {
            return new Promise((resolve) => {
              setTimeout(() => {
                input.context["task-04"] =
                  input.context["task-01"] + input.context["task-03"] + 1;
                resolve({ value: true });
              }, 1000);
            });
          },
        });
      const response: TaskOutput = await fm.run();
      expect(response["task-01"]).toBeDefined();
      expect(response["task-02"]).toBeDefined();
      expect(response["task-03"]).toBeDefined();
      expect(response["task-04"]).toBeDefined();
      expect(response["task-01"].valueOf()).toBe(1);
      expect(response["task-02"].valueOf()).toBe(2);
      expect(response["task-03"].valueOf()).toBe(3);
      expect(response["task-04"].valueOf()).toBe(5);
    });

    it("Should detect circular dependencies", async () => {
      const fm = new FlowManager("Main", {
        debug: true,
      })
        .addTask("task-01", {
          deps: ["task-02"],
          executor: (input) => {
            return new Promise((resolve) => {
              setTimeout(() => {
                input.context["task-01"] = 1;
                resolve({ value: true });
              }, 1000);
            });
          },
        })
        .addTask("task-02", {
          deps: ["task-01"],
          executor: (input) => {
            return new Promise((resolve) => {
              setTimeout(() => {
                input.context["task-02"] = input.context["task-01"] + 1;
                resolve({ value: true });
              }, 1000);
            });
          },
        });
      const response: TaskOutput = await fm.run();
    });
  });
});
