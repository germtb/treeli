/**
 * Custom JSX runtime for our TUI framework.
 * This is what the TypeScript compiler calls when it sees JSX.
 */

import {
  createVNode,
  createTextNode,
  type VNode,
  type VNodeType,
  type Props,
} from "../core/vnode.ts";
import type { Style } from "../core/cell.ts";
import type { LayoutProps, InputElementProps } from "../core/props.ts";

export type { VNode };

// BoxProps extends LayoutProps with children
interface BoxProps extends LayoutProps {
  children?: unknown;
}

interface TextProps {
  style?: Style;
  children?: unknown;
}

// Required for react-jsx transform
export function jsx(
  type: VNodeType,
  props: Props & { children?: unknown }
): VNode {
  const { children: rawChildren, ...restProps } = props;
  const children = normalizeChildren(rawChildren);

  // If type is a function (component), call it immediately
  // This ensures signal reads inside components are tracked by the reactive system
  if (typeof type === "function") {
    return type({ ...restProps, children });
  }

  return createVNode(type, restProps, children);
}

// jsxs is used when there are multiple static children
export function jsxs(
  type: VNodeType,
  props: Props & { children?: unknown }
): VNode {
  return jsx(type, props);
}

// jsxDEV is used in development mode
export const jsxDEV = jsx;

// Fragment support
export function Fragment(props: { children?: VNode[] }): VNode {
  return createVNode("fragment", {}, props.children ?? []);
}

// Helper for JSX namespace
export namespace JSX {
  export interface IntrinsicElements {
    box: BoxProps;
    text: TextProps;
    input: InputElementProps;
    fragment: { children?: unknown };
  }

  export interface Element extends VNode {}
}

/**
 * Normalize children to VNode array.
 * Handles: strings, numbers, arrays, null/undefined, VNodes
 */
function normalizeChildren(children: unknown): VNode[] {
  if (children === null || children === undefined) {
    return [];
  }

  if (Array.isArray(children)) {
    return children.flatMap(normalizeChildren);
  }

  if (typeof children === "string") {
    return [createTextNode(children)];
  }

  if (typeof children === "number") {
    return [createTextNode(String(children))];
  }

  if (isVNode(children)) {
    return [children];
  }

  return [];
}

function isVNode(value: unknown): value is VNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "props" in value &&
    "children" in value &&
    "hash" in value
  );
}
