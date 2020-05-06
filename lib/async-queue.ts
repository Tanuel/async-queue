export class AsyncQueue {
  /**
   * Number of resolved jobs
   */
  private resolved = 0;
  /**
   * Number of rejected jobs
   */
  private rejected = 0;
  /**
   * Number of pending jobs, tracked for limiting
   */
  private pending = 0;
  /**
   * Array pointer
   */
  private current = 0;
  /**
   * Max amount of jobs to be running "simultaneously" (as far as javascript/threading allows this term)
   * Can be changed anytime.
   */
  public limit: number;
  /**
   * Array of Jobs
   */
  private readonly jobs: CallableFunction[] = [];
  /**
   * Container for all callbacks for the different ListenerTypes
   * @see ListenerTypes
   */
  private callbacks: CallbackContainer = {
    next: [],
    reject: [],
    done: [],
    resolve: [],
    pending: [],
    push: [],
    finally: [],
  };
  constructor(options?: AsyncQueueOptions) {
    this.limit = options?.limit ?? 0;
    this.jobs = options?.jobs ?? [];
    this.next();
  }

  /**
   * When a job is rejected
   * @see OnReject
   */
  private reject(err: any) {
    this.callbacks.reject.forEach((cb) =>
      cb.call(this, err, this.current, this.jobs.length)
    );
    this.rejected++;
    this.finally(err);
  }

  /**
   * When a job is resolved
   * @see OnResolve
   */
  private resolve(result: any) {
    this.callbacks.resolve.forEach((cb) =>
      cb.call(this, result, this.current, this.jobs.length)
    );
    this.resolved++;
    this.finally(result);
  }

  /**
   * When a pending job is done, decrement counter and trigger next
   * @see OnFinally
   */
  private finally(result: any) {
    this.callbacks.finally.forEach((cb) =>
      cb.call(this, result, this.current, this.jobs.length)
    );

    this.pending--;
    if (this.current >= this.jobs.length && this.pending === 0) {
      this.callbacks.done.forEach((cb) => cb.call(this, this.jobs.length));
    } else if (this.current >= this.jobs.length) {
      this.callbacks.pending.forEach((cb) => cb.call(this, this.pending));
    } else {
      this.next();
    }
  }

  /**
   * Put a job in the queue and return the result when done
   */
  public async push<T>(fn: CallableFunction): Promise<T> {
    this.callbacks.push.forEach((cb) =>
      cb.call(this, fn, this.current, this.jobs.length)
    );
    return new Promise<T>((resolve, reject) => {
      this.jobs.push(async () => {
        try {
          const result = await fn();
          resolve(result);
          return result;
        } catch (e) {
          reject(e);
          throw e;
        }
      });
      this.next();
    });
  }

  /**
   * Put multiple jobs in the queue and return Promise.all
   */
  public async pushMulti(...cbs: CallableFunction[]) {
    const promises = cbs.map((cb) => {
      return new Promise((resolve) => {
        this.jobs.push(async () => {
          resolve(await cb());
        });
        this.next();
      });
    });
    return Promise.all(promises);
  }

  /**
   * Trigger the next job (if not over limit)
   */
  private next(): boolean {
    // check if limit is enabled or reached
    if (this.limit > 0 && this.pending >= this.limit) {
      return false;
    }
    // get next job
    const job = this.jobs[this.current];
    if (!job) {
      return false;
    }
    // increment counters for tracking
    this.pending++;
    this.current++;

    // trigger next job asynchronously
    runDelayed(job).then(
      (result) => this.resolve(result),
      (err) => this.reject(err)
    );
    // trigger onNext callbacks
    this.callbacks.next.forEach((cb) =>
      cb.call(this, this.current, this.jobs.length)
    );
    // trigger next job
    this.next();
    return true;
  }

  /**
   * Add an event listener for several types of events
   * @see ListenerTypes
   * @see CallbackContainer
   */
  // FIXME: Add typing for Callback types depending on ListenerTypes
  // public on<T extends ListenerTypes>(listener: T, callback: Callback<T>): AsyncQueue;
  public on(
    listener: ListenerTypes,
    callback: (...params: any[]) => any
  ): AsyncQueue {
    this.callbacks[listener].push(callback);
    return this;
  }
}

/**
 * Helper function to wrap a callback in a promise
 */
function runDelayed(cb: CallableFunction) {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        const result = await cb();
        resolve(result);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Next Job has been started
 */
export interface OnNext {
  (this: AsyncQueue, current: number, length: number): any;
}

/**
 * One or multiple jobs have been added to the queue
 */
export interface OnPush {
  (this: AsyncQueue, callback: any, current: number, length: number): any;
}

/**
 * A Job has been resolved
 */
export interface OnResolve {
  (this: AsyncQueue, result: any, current: number, length: number): any;
}

/**
 * A Job has been rejected
 */
export interface OnReject {
  (this: AsyncQueue, error: any, current: number, length: number): any;
}

/**
 * A Job has either been resolved or rejected
 */
export interface OnFinally {
  (this: AsyncQueue, result: any, current: number, length: number): any;
}

/**
 * All Jobs have been finished
 */
export interface OnDone {
  (this: AsyncQueue, length: number): any;
}

/**
 * No Jobs are left in the queue, but jobs are still pending completion
 */
export interface OnPending {
  (this: AsyncQueue, pending: number): any;
}

/**
 * The different types of event listeners
 */
type ListenerTypes =
  | "reject"
  | "done"
  | "resolve"
  | "pending"
  | "push"
  | "next"
  | "finally";

interface CallbackContainer {
  next: OnNext[];
  reject: OnReject[];
  done: OnDone[];
  resolve: OnResolve[];
  pending: OnPending[];
  push: OnPush[];
  finally: OnFinally[];
}

// FIXME: Add typing for Callback types depending on ListenerTypes
// type Callback<T extends ListenerTypes> = T extends Array<infer U> ? U : CallbackContainer[T];

/**
 * Options to pass to AsyncQueue
 */
export interface AsyncQueueOptions {
  /**
   * Max number of jobs running at once (whatever that means in single-threaded javascript)
   */
  limit?: number;
  /**
   * Array of initial functions to start of the queue
   */
  jobs?: CallableFunction[];
}
