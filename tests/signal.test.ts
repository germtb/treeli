import { describe, expect, it } from "bun:test";
import {
  createSignal,
  createEffect,
  createMemo,
  createRoot,
  onCleanup,
  batch,
  untrack,
} from "../src/core/reactive.ts";

describe("createSignal", () => {
  it("returns accessor and setter tuple", () => {
    const [count, setCount] = createSignal(0);
    expect(typeof count).toBe("function");
    expect(typeof setCount).toBe("function");
  });

  it("accessor returns current value", () => {
    const [count] = createSignal(42);
    expect(count()).toBe(42);
  });

  it("setter updates value", () => {
    const [count, setCount] = createSignal(0);
    setCount(5);
    expect(count()).toBe(5);
  });

  it("setter accepts update function", () => {
    const [count, setCount] = createSignal(10);
    setCount((prev) => prev + 5);
    expect(count()).toBe(15);
  });

  it("does not trigger for same value", () => {
    const [count, setCount] = createSignal(5);
    let effectRuns = 0;

    createRoot(() => {
      createEffect(() => {
        count();
        effectRuns++;
      });
    });

    expect(effectRuns).toBe(1);
    setCount(5); // Same value
    expect(effectRuns).toBe(1);
  });

  it("works with objects", () => {
    const [state, setState] = createSignal({ name: "Alice", age: 30 });
    expect(state().name).toBe("Alice");

    setState({ name: "Bob", age: 25 });
    expect(state().name).toBe("Bob");
  });

  it("works with arrays", () => {
    const [items, setItems] = createSignal([1, 2, 3]);
    expect(items()).toEqual([1, 2, 3]);

    setItems((arr) => [...arr, 4]);
    expect(items()).toEqual([1, 2, 3, 4]);
  });
});

describe("createEffect", () => {
  it("runs immediately", () => {
    let ran = false;
    createRoot(() => {
      createEffect(() => {
        ran = true;
      });
    });
    expect(ran).toBe(true);
  });

  it("re-runs when dependencies change", () => {
    const [count, setCount] = createSignal(0);
    const values: number[] = [];

    createRoot(() => {
      createEffect(() => {
        values.push(count());
      });
    });

    setCount(1);
    setCount(2);

    expect(values).toEqual([0, 1, 2]);
  });

  it("tracks multiple signals", () => {
    const [a, setA] = createSignal(1);
    const [b, setB] = createSignal(2);
    const sums: number[] = [];

    createRoot(() => {
      createEffect(() => {
        sums.push(a() + b());
      });
    });

    expect(sums).toEqual([3]);

    setA(10);
    expect(sums).toEqual([3, 12]);

    setB(20);
    expect(sums).toEqual([3, 12, 30]);
  });

  it("runs cleanup before re-running", () => {
    const [count, setCount] = createSignal(0);
    let cleanups = 0;

    createRoot(() => {
      createEffect(() => {
        count();
        return () => {
          cleanups++;
        };
      });
    });

    expect(cleanups).toBe(0);
    setCount(1);
    expect(cleanups).toBe(1);
    setCount(2);
    expect(cleanups).toBe(2);
  });

  it("cleanup runs on dispose", () => {
    const [count] = createSignal(0);
    let cleanups = 0;

    createRoot((dispose) => {
      createEffect(() => {
        count();
        return () => {
          cleanups++;
        };
      });

      expect(cleanups).toBe(0);
      dispose();
      expect(cleanups).toBe(1);
    });
  });
});

describe("createMemo", () => {
  it("computes derived value", () => {
    const [count] = createSignal(5);

    let computeCount = 0;
    const doubled = createMemo(() => {
      computeCount++;
      return count() * 2;
    });

    expect(doubled()).toBe(10);
    expect(computeCount).toBe(1);
  });

  it("updates when dependency changes", () => {
    const [count, setCount] = createSignal(5);
    const doubled = createMemo(() => count() * 2);

    expect(doubled()).toBe(10);
    setCount(10);
    expect(doubled()).toBe(20);
  });

  it("chains memos", () => {
    const [count, setCount] = createSignal(2);
    const doubled = createMemo(() => count() * 2);
    const quadrupled = createMemo(() => doubled() * 2);

    expect(quadrupled()).toBe(8);
    setCount(5);
    expect(quadrupled()).toBe(20);
  });
});

describe("createRoot", () => {
  it("returns the result of the function", () => {
    const result = createRoot(() => 42);
    expect(result).toBe(42);
  });

  it("dispose cleans up effects", () => {
    const [count, setCount] = createSignal(0);
    const values: number[] = [];

    createRoot((dispose) => {
      createEffect(() => {
        values.push(count());
      });

      setCount(1);
      expect(values).toEqual([0, 1]);

      dispose();
      setCount(2);
      expect(values).toEqual([0, 1]); // No new value added
    });
  });
});

describe("onCleanup", () => {
  it("runs when root is disposed", () => {
    let cleaned = false;

    createRoot((dispose) => {
      onCleanup(() => {
        cleaned = true;
      });

      expect(cleaned).toBe(false);
      dispose();
      expect(cleaned).toBe(true);
    });
  });
});

describe("batch", () => {
  it("batches multiple updates", () => {
    const [a, setA] = createSignal(0);
    const [b, setB] = createSignal(0);
    let effectRuns = 0;

    createRoot(() => {
      createEffect(() => {
        a();
        b();
        effectRuns++;
      });
    });

    expect(effectRuns).toBe(1);

    batch(() => {
      setA(1);
      setB(2);
    });

    expect(effectRuns).toBe(2); // Only one additional run
  });

  it("handles nested batches", () => {
    const [count, setCount] = createSignal(0);
    let effectRuns = 0;

    createRoot(() => {
      createEffect(() => {
        count();
        effectRuns++;
      });
    });

    batch(() => {
      setCount(1);
      batch(() => {
        setCount(2);
      });
      setCount(3);
    });

    expect(effectRuns).toBe(2); // Initial + one batched
    expect(count()).toBe(3);
  });

  it("returns the result of the function", () => {
    const result = batch(() => 42);
    expect(result).toBe(42);
  });
});

describe("untrack", () => {
  it("prevents tracking inside untrack", () => {
    const [count, setCount] = createSignal(0);
    let effectRuns = 0;

    createRoot(() => {
      createEffect(() => {
        untrack(() => count());
        effectRuns++;
      });
    });

    expect(effectRuns).toBe(1);
    setCount(1);
    expect(effectRuns).toBe(1); // Still 1, not tracked
  });

  it("returns the value", () => {
    const [count] = createSignal(42);
    const value = untrack(() => count());
    expect(value).toBe(42);
  });
});

describe("Solid.js patterns", () => {
  it("component-local state pattern", () => {
    function createCounter(initial = 0) {
      const [count, setCount] = createSignal(initial);

      return {
        count,
        increment: () => setCount((c) => c + 1),
        decrement: () => setCount((c) => c - 1),
      };
    }

    const counter1 = createCounter(0);
    const counter2 = createCounter(100);

    counter1.increment();
    counter1.increment();
    counter2.decrement();

    expect(counter1.count()).toBe(2);
    expect(counter2.count()).toBe(99);
  });

  it("derived state with memo", () => {
    const [firstName, setFirstName] = createSignal("John");
    const [lastName, setLastName] = createSignal("Doe");

    const fullName = createMemo(() => `${firstName()} ${lastName()}`);

    expect(fullName()).toBe("John Doe");

    setFirstName("Jane");
    expect(fullName()).toBe("Jane Doe");

    setLastName("Smith");
    expect(fullName()).toBe("Jane Smith");
  });

  it("conditional effects", () => {
    const [show, setShow] = createSignal(true);
    const [count, setCount] = createSignal(0);
    const values: number[] = [];

    createRoot(() => {
      createEffect(() => {
        if (show()) {
          values.push(count());
        }
      });
    });

    expect(values).toEqual([0]);

    setCount(1);
    expect(values).toEqual([0, 1]);

    setShow(false);
    setCount(2);
    // Effect still tracks show(), so it runs but doesn't push
    // because show() is false in the effect body
    expect(values).toEqual([0, 1]);
  });
});
