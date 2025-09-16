import { expect, test, describe, it } from "bun:test";
import { FlowManager } from "./flow-manager";
import type { TaskOutput } from "./models";

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
      expect(response["task-01"].valueOf()).toEqual({ value: true });
      expect(response["task-02"].valueOf()).toEqual({ value: true });
      expect(response["task-03"].valueOf()).toEqual({ value: true });
      expect(response["task-04"].valueOf()).toEqual({ value: true });
    });

    it("Should detect circular dependencies", async () => {
      const fm = new FlowManager("Main", {
        debug: true,
      })
        .addTask("task-01", {
          deps: ["task-02"],
          executor: (_input) => ({}),
        })
        .addTask("task-02", {
          deps: ["task-01"],
          executor: (_input) => ({}),
        });
      await expect(fm.run()).rejects.toThrow(/Circular dependency/);
    });

    it("Should throw if one task fails", async () => {
      const fm = new FlowManager("Main", {
        debug: true,
      }).addTask("task-01", {
        executor: (input) => {
          return new Promise((_resolve, reject) => {
            setTimeout(() => {
              input.context["task-01"] = 1;
              reject(new Error("Task failed"));
            }, 1000);
          });
        },
      });
      await expect(fm.run()).rejects.toThrow(/Task failed/);
    });
  });
});
