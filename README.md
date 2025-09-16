# simple-workflow-js

[![Publish Package](https://github.com/mamang126/simple-workflow-js/actions/workflows/publish.yml/badge.svg?branch=main&event=status)](https://github.com/mamang126/simple-workflow-js/actions/workflows/publish.yml)

A lightweight, modular workflow/task orchestration library for JavaScript and TypeScript, built to run on [Bun](https://bun.sh). Define, sequence, and execute tasks (sync or async) with dependency management and context passing.

---

## Features

- **Task and Flow Management**: Compose and run tasks in order or in parallel.
- **Context Passing**: Each task receives and can modify a shared context object.
- **Async Support**: Tasks can be synchronous or asynchronous.
- **Dependency Management**: Specify dependencies between tasks.
- **TypeScript Support**: Fully typed interfaces for tasks and flows.

---

## Installation

```bash
bun install simple-workflow-js
```

---

## Quick Start

```typescript
import { FlowManager, Task } from "simple-workflow-js";

const flow = new FlowManager("Example")
  .addTask(
    new Task("init", {
      executor: (input) => ({
        context: { ...input.context, value: 1 },
      }),
    })
  )
  .addTask(
    new Task("step1", {
      executor: (input) => ({
        context: { ...input.context, value: input.context.value + 10 },
      }),
    })
  );

flow.run().then((result) => {
  console.log(result.context); // { value: 11 }
});
```

## Advanced Example: Nested Workflow

You can nest workflows by creating a main workflow and, inside a task, running another workflow. This allows for modular and reusable orchestration logic.

```typescript
import { FlowManager, Task } from "test-flowed";

const subFlow = new FlowManager("SubFlow")
  .addTask(
    new Task("sub-task-1", {
      executor: (input) => ({
        context: { ...input.context, subValue: 100 },
      }),
    })
  )
  .addTask(
    new Task("sub-task-2", {
      executor: (input) => ({
        context: { ...input.context, subValue: input.context.subValue + 50 },
      }),
    })
  );

const mainFlow = new FlowManager("MainFlow")
  .addTask(
    new Task("init", {
      executor: (input) => ({
        context: { ...input.context, value: 1 },
      }),
    })
  )
  .addTask(
    new Task("nested", {
      executor: async (input) => {
        const subResult = await subFlow.run({ context: input.context });
        return {
          context: { ...input.context, ...subResult.context },
        };
      },
    })
  )
  .addTask(
    new Task("final", {
      executor: (input) => ({
        context: {
          ...input.context,
          value: input.context.value + input.context.subValue,
        },
      }),
    })
  );

mainFlow.run().then((result) => {
  console.log(result.context); // { value: 151, subValue: 150 }
});
```

---

## Project Structure

- `src/flow-manager.ts`: Core library for defining and running tasks and flows.
- `src/task.ts`: Task class implementation.
- `src/types.ts`: Type definitions and interfaces.
- `index.ts`: Entry point for npm consumers.

---

## License

Apache License 2.0. See `LICENSE` for details.
