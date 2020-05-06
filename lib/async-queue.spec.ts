import { AsyncQueue } from "./async-queue";

describe("AsyncQueue", () => {
  test("resolve", async () => {
    const queue1 = new AsyncQueue();
    const fn = () =>
      new Promise((resolve) => setTimeout(resolve.bind(null, "resolved"), 100));
    const result = await queue1.push(fn);
    expect(result).toBe("resolved");
  });

  test("reject", async () => {
    const queue2 = new AsyncQueue();
    const fn = () =>
      new Promise((resolve, reject) =>
        setTimeout(reject.bind(null, "rejected"), 100)
      );
    try {
      await queue2.push(fn);
    } catch (e) {
      expect(e).toBe("rejected");
    }
  });

  test("hooks", async () => {
    const mockPush = jest.fn();
    const mockResolve = jest.fn();
    const mockReject = jest.fn();
    const mockFinally = jest.fn();
    const mockNext = jest.fn();
    const mockPending = jest.fn();
    const mockDone = jest.fn();
    const queue3 = new AsyncQueue();
    // wrap in a promise to resolve later when everything is done
    const awaiter = new Promise((resolve) => {
      queue3
        .on("push", (response) => mockPush(response))
        .on("resolve", (response) => mockResolve(response))
        .on("reject", (response) => mockReject(response))
        .on("finally", (response) => mockFinally(response))
        .on("next", (response) => mockNext(response))
        .on("pending", (response) => {
          mockPending(response);
        })
        .on("done", (response) => mockDone(response))
        // this will be used later to await all pending jobs
        .on("done", () => {
          resolve();
        });
    });
    const fnResolve = () =>
      new Promise((resolve) => setTimeout(resolve.bind(null, "resolved"), 10));
    const fnReject = () =>
      new Promise((resolve, reject) =>
        setTimeout(reject.bind(null, "rejected"), 10)
      );
    // ignore result here, since we will handle it in the resolve hook
    queue3.push(fnResolve);
    // ignore errors, but node requires catching rejections
    queue3.push(fnReject).catch(() => null);

    // wait for queue to finish all calls in the node event loop
    await awaiter;

    expect(mockPush).toHaveBeenCalledWith(fnResolve);
    expect(mockPush).toHaveBeenCalledWith(fnReject);
    expect(mockResolve).toHaveBeenCalledWith("resolved");
    expect(mockReject).toHaveBeenCalledWith("rejected");
    expect(mockFinally).toHaveBeenCalledWith("resolved");
    expect(mockFinally).toHaveBeenCalledWith("rejected");
    expect(mockPending).toHaveBeenCalledWith(1);
    expect(mockPending).toHaveBeenCalledTimes(1);
    expect(mockDone).toHaveBeenCalledWith(2);
    expect(mockDone).toHaveBeenCalledTimes(1);
  });

  test("push multi", async () => {
    const jobs = [];
    for (let i = 0; i < 10; i++) {
      jobs.push(() => new Promise((resolve) => resolve(i)));
    }

    const queue4 = new AsyncQueue();
    const result = await queue4.pushMulti(...jobs);
    expect(result).toMatchSnapshot();
  });

  // Fake a mutex to check if only one job is running at a time
  test("limit", async () => {
    const mutexError = jest.fn();
    const mutexTriggered = jest.fn();
    const mutexReleased = jest.fn();
    const jobs = [];
    let mutex = false;
    const requestMutex = (num: any) => {
      if (mutex) {
        mutexError(num);
      }
      mutexTriggered();
      mutex = true;
    };
    const releaseMutex = (num: any) => {
      mutex = false;
      mutexReleased();
    };
    for (let i = 0; i < 10; i++) {
      jobs.push(
        () =>
          new Promise((resolve) => {
            requestMutex(i);
            setTimeout(() => {
              releaseMutex(i);
              resolve(i);
            }, 10);
          })
      );
    }

    const queue4 = new AsyncQueue({
      limit: 1,
    });
    await queue4.pushMulti(...jobs);
    expect(mutexError).not.toHaveBeenCalled();
    expect(mutexTriggered).toHaveBeenCalledTimes(10);
    expect(mutexReleased).toHaveBeenCalledTimes(10);
  });
});
