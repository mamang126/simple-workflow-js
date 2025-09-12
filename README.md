# test-flowed

A lightweight workflow/task orchestration library for JavaScript and TypeScript, built to run on [Bun](https://bun.sh). It allows you to define, sequence, and execute tasks (both synchronous and asynchronous) in series or parallel, with context passing and dependency management.

## Features

- **Task and Flow Management**: Compose tasks and run them in order or in parallel.
- **Context Passing**: Each task receives and can modify a shared context object.
- **Async Support**: Tasks can be synchronous or asynchronous.
- **Parallel Execution**: Run multiple tasks concurrently and merge their results.
- **TypeScript Support**: Fully typed interfaces for tasks and flows.

## Usage

### Install dependencies

```bash
bun install
```

### Run the project

```bash
bun run index.js
```

### Example

See `flow-manager.spec.ts` for usage examples and tests:

```typescript
import { FlowManager, Task } from "./flow-manager";

const fm = new FlowManager("Main");
fm.addTask(
  new Task("init", {
    executor: (input) => ({
      ...input,
      context: { ...input.context, value: 1 },
    }),
  })
)
  .addTask(
    new Task("step1", {
      executor: (input) => ({
        ...input,
        context: { ...input.context, value: input.context.value + 10 },
      }),
    })
  )
  .run();
```

### Advanced Example: Nested Workflow

You can nest workflows by creating a main workflow and, inside a task, running another workflow. This allows for modular and reusable orchestration logic.

```typescript
import { FlowManager, Task } from "./flow-manager";

// Define a sub-workflow
const subFlow = new FlowManager("SubFlow")
  .addTask(
    new Task("sub-task-1", {
      executor: (input) => ({
        ...input,
        context: { ...input.context, subValue: 100 },
      }),
    })
  )
  .addTask(
    new Task("sub-task-2", {
      executor: (input) => ({
        ...input,
        context: { ...input.context, subValue: input.context.subValue + 50 },
      }),
    })
  );

// Define the main workflow
const mainFlow = new FlowManager("MainFlow")
  .addTask(
    new Task("init", {
      executor: (input) => ({
        ...input,
        context: { ...input.context, value: 1 },
      }),
    })
  )
  .addTask(
    new Task("nested", {
      executor: async (input) => {
        // Run the sub-workflow inside this task
        const subResult = await subFlow.run({
          context: input.context,
          outputs: {},
        });
        return {
          ...input,
          context: { ...input.context, ...subResult.context },
        };
      },
    })
  )
  .addTask(
    new Task("final", {
      executor: (input) => ({
        ...input,
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

## Project Structure

- `flow-manager.ts`: Core library for defining and running tasks and flows.
- `flow-manager.spec.ts`: Tests and usage examples.
- `index.js` / `index.ts`: Entry points.

## License

Apache License 2.0. See `LICENSE` for details.
