/**
 * Demo: NERDTree-style file explorer
 * Run with: bun examples/nerdtree-demo.tsx [directory]
 */

import {
  createSignal,
  run,
  KEYS,
  type Color,
} from "../src/index.ts";
import { readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";

// File type icons (Nerd Font icons)
const ICONS: Record<string, string> = {
  // Folders
  folder: "\uf07b",
  folderOpen: "\uf07c",

  // Common file types
  ts: "\ue628",
  tsx: "\ue628",
  js: "\ue781",
  jsx: "\ue781",
  json: "\ue60b",
  md: "\ue73e",
  txt: "\uf0f6",
  html: "\ue736",
  css: "\ue749",
  scss: "\ue749",
  py: "\ue73c",
  rb: "\ue739",
  go: "\ue627",
  rs: "\ue7a8",
  sh: "\ue795",
  yml: "\ue60b",
  yaml: "\ue60b",
  git: "\ue702",
  lock: "\uf023",

  // Default
  default: "\uf15b",
};

// File type colors
const COLORS: Record<string, Color> = {
  ts: "cyan",
  tsx: "cyan",
  js: "yellow",
  jsx: "yellow",
  json: "yellow",
  md: "white",
  folder: "blue",
  default: { rgb: [180, 180, 180] },
};

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
  expanded?: boolean;
  level: number;
}

// Build file tree from directory
function buildTree(dir: string, level: number = 0, maxDepth: number = 3): FileNode[] {
  if (level >= maxDepth) return [];

  try {
    const entries = readdirSync(dir);
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      // Skip hidden files and common ignore patterns
      if (entry.startsWith(".") || entry === "node_modules") continue;

      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        const node: FileNode = {
          name: entry,
          path: fullPath,
          isDirectory: stat.isDirectory(),
          level,
          expanded: level === 0, // Auto-expand first level
        };

        if (node.isDirectory) {
          node.children = buildTree(fullPath, level + 1, maxDepth);
        }

        nodes.push(node);
      } catch {
        // Skip inaccessible files
      }
    }

    // Sort: directories first, then files, alphabetically
    return nodes.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}

// Get icon for file
function getIcon(node: FileNode): string {
  if (node.isDirectory) {
    return node.expanded ? ICONS.folderOpen! : ICONS.folder!;
  }

  const ext = node.name.split(".").pop()?.toLowerCase() ?? "";
  return ICONS[ext] ?? ICONS.default!;
}

// Get color for file
function getColor(node: FileNode): Color {
  if (node.isDirectory) return COLORS.folder!;

  const ext = node.name.split(".").pop()?.toLowerCase() ?? "";
  return COLORS[ext] ?? COLORS.default!;
}

// Flatten tree for display (only expanded nodes)
function flattenTree(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];

  for (const node of nodes) {
    result.push(node);
    if (node.isDirectory && node.expanded && node.children) {
      result.push(...flattenTree(node.children));
    }
  }

  return result;
}

// State
const rootDir = process.argv[2] || process.cwd();
const [tree, setTree] = createSignal<FileNode[]>(buildTree(rootDir));
const [selectedIndex, setSelectedIndex] = createSignal(0);
const [message, setMessage] = createSignal("");

// Get visible items
function getVisibleItems(): FileNode[] {
  return flattenTree(tree());
}

// Toggle expand/collapse
function toggleExpand(node: FileNode): void {
  if (!node.isDirectory) {
    setMessage(`Selected: ${node.path}`);
    return;
  }

  // Deep clone and toggle
  const updateNode = (nodes: FileNode[]): FileNode[] => {
    return nodes.map(n => {
      if (n.path === node.path) {
        return { ...n, expanded: !n.expanded };
      }
      if (n.children) {
        return { ...n, children: updateNode(n.children) };
      }
      return n;
    });
  };

  setTree(updateNode(tree()));
}

// Render a single file entry
function FileEntry(props: { node: FileNode; selected: boolean }) {
  const { node, selected } = props;
  const indent = "  ".repeat(node.level);
  const icon = getIcon(node);
  const nodeColor = getColor(node);
  const arrow = node.isDirectory ? (node.expanded ? "\u25bc" : "\u25b6") : " ";

  const textColor: Color = selected ? "black" : nodeColor;
  const backgroundColor: Color | undefined = selected ? "cyan" : undefined;

  return (
    <box direction="row">
      <text style={{ color: textColor, background: backgroundColor }}>{indent}</text>
      <text style={{ color: selected ? "black" : { rgb: [100, 100, 100] as const }, background: backgroundColor }}>{arrow} </text>
      <text style={{ color: textColor, background: backgroundColor }}>{icon} </text>
      <text style={{ color: textColor, background: backgroundColor, bold: node.isDirectory }}>{node.name}</text>
    </box>
  );
}

function App() {
  const items = getVisibleItems();
  const selected = selectedIndex();
  const msg = message();

  // Limit display to terminal height
  const maxVisible = 20;
  const start = Math.max(0, Math.min(selected - Math.floor(maxVisible / 2), items.length - maxVisible));
  const visibleItems = items.slice(start, start + maxVisible);
  const displayOffset = start;

  return (
    <box direction="column" padding={1}>
      <box direction="row" margin={{ bottom: 1 }}>
        <text style={{ color: "yellow", bold: true }}>{"\uf07b"} </text>
        <text style={{ color: "yellow", bold: true }}>{basename(rootDir)}</text>
        <text style={{ color: { rgb: [100, 100, 100] } }}> ({items.length} items)</text>
      </box>

      <box direction="column">
        {visibleItems.map((node, i) => (
          <FileEntry
            node={node}
            selected={displayOffset + i === selected}
          />
        ))}
      </box>

      <box margin={{ top: 1 }}>
        <text style={{ color: { rgb: [100, 100, 100] } }}>
          [j/k] Navigate  [Enter] Expand/Select  [q] Quit
        </text>
      </box>

      {msg && (
        <box margin={{ top: 1 }}>
          <text style={{ color: "green" }}>{msg}</text>
        </box>
      )}
    </box>
  );
}

run(App, {
  onKeypress(key) {
    const items = getVisibleItems();
    const current = selectedIndex();

    if (key === "j" || key === KEYS.DOWN) {
      setSelectedIndex(Math.min(current + 1, items.length - 1));
      setMessage("");
    } else if (key === "k" || key === KEYS.UP) {
      setSelectedIndex(Math.max(current - 1, 0));
      setMessage("");
    } else if (key === KEYS.ENTER || key === "l") {
      const node = items[current];
      if (node) toggleExpand(node);
    } else if (key === "h") {
      // Collapse current or go to parent
      const node = items[current];
      if (node?.isDirectory && node.expanded) {
        toggleExpand(node);
      }
    } else if (key === "g") {
      setSelectedIndex(0);
    } else if (key === "G") {
      setSelectedIndex(items.length - 1);
    }
  },
});
