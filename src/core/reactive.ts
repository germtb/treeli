/**
 * Solid.js-style reactive signals.
 *
 * Key principles:
 * - Components run ONCE (setup phase)
 * - Signals created inside components are local to that instance
 * - Fine-grained reactivity: only re-run what depends on changed signals
 * - No rules of hooks - signals are just values
 */

// ============================================================================
// Core Types
// ============================================================================

export type Accessor<T> = () => T;
export type Setter<T> = {
  (value: T): void;
  (fn: (prev: T) => T): void;
};

export type Signal<T> = [Accessor<T>, Setter<T>];

type Computation = {
  execute: () => void;
  dependencies: Set<Set<Computation>>;
};

// ============================================================================
// Global Reactive Context
// ============================================================================

let currentComputation: Computation | null = null;
let batchDepth = 0;
const pendingComputations = new Set<Computation>();

// ============================================================================
// Signal Implementation
// ============================================================================

/**
 * Create a reactive signal.
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const [count, setCount] = createSignal(0);
 *   return (
 *     <box>
 *       <text>Count: {count()}</text>
 *       <text onPress={() => setCount(c => c + 1)}>+</text>
 *     </box>
 *   );
 * }
 * ```
 */
export function createSignal<T>(initialValue: T): Signal<T> {
  let value = initialValue;
  const subscribers = new Set<Computation>();

  const read: Accessor<T> = () => {
    // Track this signal as a dependency of current computation
    if (currentComputation) {
      subscribers.add(currentComputation);
      currentComputation.dependencies.add(subscribers);
    }
    return value;
  };

  const write: Setter<T> = (nextValue: T | ((prev: T) => T)) => {
    const newValue = typeof nextValue === "function"
      ? (nextValue as (prev: T) => T)(value)
      : nextValue;

    if (Object.is(value, newValue)) return;
    value = newValue;

    // Notify subscribers
    if (batchDepth > 0) {
      for (const comp of subscribers) {
        pendingComputations.add(comp);
      }
    } else {
      const toRun = [...subscribers];
      for (const comp of toRun) {
        comp.execute();
      }
    }
  };

  return [read, write];
}

// ============================================================================
// Effects
// ============================================================================

/**
 * Create a reactive effect that runs when its dependencies change.
 * Returns a dispose function to stop the effect.
 *
 * @example
 * ```tsx
 * const [count, setCount] = createSignal(0);
 *
 * createEffect(() => {
 *   console.log("Count is:", count());
 * });
 * ```
 */
export function createEffect(fn: () => void | (() => void)): () => void {
  let cleanup: void | (() => void);
  let disposed = false;

  const computation: Computation = {
    execute: () => {
      if (disposed) return;

      // Cleanup previous run
      if (cleanup) {
        cleanup();
        cleanup = undefined;
      }

      // Clear old dependencies
      for (const dep of computation.dependencies) {
        dep.delete(computation);
      }
      computation.dependencies.clear();

      // Run with tracking
      const prevComputation = currentComputation;
      currentComputation = computation;
      try {
        cleanup = fn();
      } finally {
        currentComputation = prevComputation;
      }
    },
    dependencies: new Set(),
  };

  // Initial run
  computation.execute();

  // Dispose function
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (cleanup) cleanup();
    for (const dep of computation.dependencies) {
      dep.delete(computation);
    }
    computation.dependencies.clear();
  };

  // Register with current owner for automatic cleanup
  if (currentOwner) {
    currentOwner.disposables.push(dispose);
  }

  return dispose;
}

/**
 * Create a memoized computation.
 * Only re-computes when dependencies change.
 */
export function createMemo<T>(fn: () => T): Accessor<T> {
  const [value, setValue] = createSignal<T>(undefined as T);

  createEffect(() => {
    setValue(fn());
  });

  return value;
}

// ============================================================================
// Reactive Roots & Rendering
// ============================================================================

export interface Owner {
  disposables: (() => void)[];
}

let currentOwner: Owner | null = null;

/**
 * Create a reactive root. All reactive primitives created inside
 * will be cleaned up when the root is disposed.
 */
export function createRoot<T>(fn: (dispose: () => void) => T): T {
  const owner: Owner = { disposables: [] };

  const prevOwner = currentOwner;
  currentOwner = owner;

  let result: T;
  try {
    result = fn(() => {
      for (const dispose of owner.disposables) {
        dispose();
      }
      owner.disposables = [];
    });
  } finally {
    currentOwner = prevOwner;
  }

  return result;
}

/**
 * Register a cleanup function to run when the current owner is disposed.
 */
export function onCleanup(fn: () => void): void {
  if (currentOwner) {
    currentOwner.disposables.push(fn);
  }
}

// ============================================================================
// Batching
// ============================================================================

/**
 * Batch multiple signal updates into a single update cycle.
 */
export function batch<T>(fn: () => T): T {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      const toRun = [...pendingComputations];
      pendingComputations.clear();
      for (const comp of toRun) {
        comp.execute();
      }
    }
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Read a signal without tracking it as a dependency.
 */
export function untrack<T>(fn: () => T): T {
  const prevComputation = currentComputation;
  currentComputation = null;
  try {
    return fn();
  } finally {
    currentComputation = prevComputation;
  }
}

/**
 * Check if we're currently inside a reactive tracking context.
 */
export function isTracking(): boolean {
  return currentComputation !== null;
}

// ============================================================================
// Reactive Components Helper
// ============================================================================

export type Component<P = {}> = (props: P) => VNodeResult;
export type VNodeResult = unknown; // Will be VNode from vnode.ts

/**
 * Helper to create a component with reactive children.
 * Children that are functions will be treated as reactive accessors.
 */
export function children<T>(fn: () => T): Accessor<T> {
  return createMemo(fn);
}
