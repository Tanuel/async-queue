[![Powered by Tanuel](https://img.shields.io/badge/Powered%20by-Tanuel-b22.svg)](https://github.com/Tanuel)
[![Documentation](https://img.shields.io/badge/-Documentation-blueviolet.svg)](https://github.com/Tanuel/async-queue#readme)
[![npm](https://img.shields.io/npm/v/@tanuel/async-queue.svg?logo=npm)](https://www.npmjs.com/package/@tanuel/async-queue)
[![npm](https://img.shields.io/npm/dt/@tanuel/async-queue.svg?logo=npm)](https://www.npmjs.com/package/@tanuel/async-queue)

# @tanuel/async-queue

A zero dependency Promise based job queue with limited concurrency, written in TypeScript.

## Why the scoped name?

Most names like async-queue or asynq etc. are already used by other (abandoned?) projects, so to avoid
having a confusing package name, we added the scope to it.

## Installing

    yarn add @tanuel/async-queue
    # or
    npm install @tanuel/async-queue --save

## Usage

```javascript
import { AsyncQueue } from "@tanuel/async-queue";

(async () => {
  const queue = new AsyncQueue();
  queue.on("done", () => {
    console.log("Queue is finished");
  });
  const fn = () => {
    new Promise((resolve) => setTimeout(resolve.bind(null, "resolved"), 100));
  };
  const result = await queue.push(fn);
  console.log("Job has been resolved with result", result);
})();
```

This could be used to limit concurrency of network requests, e.g. if you want to load a lot of api requests

```javascript
import { AsyncQueue } from "@tanuel/async-queue";

const urls = [
  // an array of a lot of urls
];

(async () => {
  const queue = new AsyncQueue({ limit: 50 });
  for (const u of urls) {
    // queue in all the urls
    queue
      .push(() => jobWithNetworkIO(u))
      .then((result) => {
        // add even more jobs to the queue based on previous jobs
        // e.g. fetch details after fetching a specific list
        for (const item of result) {
          queue.push(() => fetchDetails(item.url));
        }
      });
  }
  let resolved = 0;
  let rejected = 0;
  queue
    .on("next", (c, l) => {
      console.log("next call triggered");
    })
    .on("reject", (e) => {
      console.error("A job has been rejected:", e);
      rejected++;
    })
    .on("resolve", (result) => {
      console.log("A job has been resolved", result);
      resolved++;
    })
    .on("pending", (p) => {
      // There are no more remaining jobs in the queue, but not all jobs have been finished
      console.log("Waiting for " + p + " pending Jobs to finish");
    })
    .on("done", () => {
      console.log("All jobs are done");
      console.log(resolved, "Jobs resolved");
      console.log(rejected, "Jobs rejected");
    });
})();
```

## TypeScript

This project was written entirely in TypeScript, so you can make use of the provided type definitions!

## Contributing

Feel free to open issues or pull requests on GitHub. Do not add unnecessary production dependencies, as we want
to keep the dependency tree as small as possible

After cloing the project, simply run `yarn install`, then `yarn build` to compile or `yarn test` to run tests
