/**
 * VNode: The virtual node type with Merkle-style content hashing.
 * The hash enables fast subtree comparison - if hashes match, subtrees are identical.
 */

import type { Style } from "./cell.ts";

// Props that can be passed to elements
export interface BaseProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  style?: Style;
}

export type Props = BaseProps & Record<string, unknown>;

// A functional component with typed props
export type Component<P = Props> = (props: P) => VNode;

// VNode can have an intrinsic type (string) or a component function
export type VNodeType = string | Component<Props>;

export interface VNode {
  type: VNodeType;
  props: Props;
  children: VNode[];
  hash: string;
}

// Text nodes are represented as VNodes with type "__text__"
export const TEXT_NODE_TYPE = "__text__";

export function isTextNode(node: VNode): boolean {
  return node.type === TEXT_NODE_TYPE;
}

export function getTextContent(node: VNode): string {
  return (node.props.text as string) ?? "";
}

/**
 * Fast hash function (FNV-1a).
 * For TUI elements, this is plenty fast and has good distribution.
 */
export function fnv1a(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Compute the hash for a VNode.
 * This is the Merkle property: hash = f(type, props, children.hashes)
 */
export function computeHash(type: VNodeType, props: Props, children: VNode[]): string {
  const typeStr = typeof type === "string" ? type : type.name || "anonymous";
  const propsStr = stableStringify(props);
  const childHashes = children.map((c) => c.hash).join(",");
  return fnv1a(`${typeStr}|${propsStr}|${childHashes}`);
}

/**
 * Stable JSON stringify - sorts object keys for consistent hashing.
 */
function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return "";
  if (typeof obj !== "object") return String(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(stableStringify).join(",") + "]";
  }
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys.map((k) => `${k}:${stableStringify((obj as Record<string, unknown>)[k])}`).join(",") +
    "}"
  );
}

/**
 * Create a VNode. This is the low-level factory - JSX calls this.
 * Overloaded to support both intrinsic elements and typed components.
 */
export function createVNode(type: string, props: Props, children: VNode[]): VNode;
export function createVNode<P>(type: Component<P>, props: P, children: VNode[]): VNode;
export function createVNode(type: VNodeType, props: Props, children: VNode[]): VNode {
  const hash = computeHash(type, props, children);
  return { type, props, children, hash };
}

/**
 * Create a text VNode.
 */
export function createTextNode(text: string): VNode {
  return createVNode(TEXT_NODE_TYPE, { text }, []);
}

/**
 * Expand functional components into their rendered output.
 * Note: With the current JSX runtime, components are expanded at JSX time,
 * so this mainly handles edge cases and recursively expands children.
 */
export function expandNode(node: VNode): VNode {
  // If it's a text node or intrinsic element, just expand children
  if (typeof node.type === "string") {
    const expandedChildren = node.children.map((c) => expandNode(c));
    // Only create new node if children changed
    const childrenChanged = expandedChildren.some((c, i) => c !== node.children[i]);
    if (!childrenChanged) return node;
    return createVNode(node.type, node.props, expandedChildren);
  }

  // It's a functional component (shouldn't happen with current JSX runtime,
  // but handle it for safety)
  const component = node.type;
  const result = component({ ...node.props, children: node.children });
  return expandNode(result);
}
