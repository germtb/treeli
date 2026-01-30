/**
 * Rich select demo showing:
 * - Multiple selects with focus navigation (Tab/Shift+Tab)
 * - Input fields
 * - FZF-like filtered select pattern
 *
 * Run with: bun examples/select-demo.tsx
 */

import {
  run,
  createSelect,
  createInput,
  createSignal,
  createMemo,
  createEffect,
  KEYS,
  defaultInputHandler,
} from "../src/index.ts";

// === Form with multiple focusables ===

const languageSelect = createSelect({
  initialValue: "typescript",
});

const frameworkSelect = createSelect({
  initialValue: "react",
});

const projectName = createInput({
  placeholder: "my-project",
});

// === FZF-like filtered select ===

const allOptions = [
  "apple", "apricot", "avocado",
  "banana", "blueberry", "blackberry",
  "cherry", "coconut", "cranberry",
  "date", "dragonfruit",
  "elderberry",
  "fig",
  "grape", "grapefruit", "guava",
  "honeydew",
  "kiwi",
  "lemon", "lime", "lychee",
  "mango", "melon",
  "orange",
  "papaya", "peach", "pear", "pineapple", "plum", "pomegranate",
  "raspberry",
  "strawberry",
  "tangerine",
  "watermelon",
];

// FZF input that bubbles arrow keys to the select
const fzfInput = createInput({
  placeholder: "Type to filter...",
  onKeypress: (key, state) => {
    // Navigation keys go to fzfSelect instead of the input
    if (key === KEYS.UP || key === KEYS.CTRL_P || key === KEYS.CTRL_K) {
      fzfSelect.prev();
      return state; // Consume but don't change state
    }
    if (key === KEYS.DOWN || key === KEYS.CTRL_N || key === KEYS.CTRL_J) {
      fzfSelect.next();
      return state; // Consume but don't change state
    }
    if (key === KEYS.ENTER) {
      // Selection already happened via navigation, just consume
      return state;
    }
    // Everything else uses default input handling
    return defaultInputHandler(key, state);
  },
});

const fzfSelect = createSelect<string>({
  focusable: false, // Navigation only, not part of Tab order
});

// Filtered options based on input
const filteredOptions = createMemo(() => {
  const query = fzfInput.value().toLowerCase();
  if (!query) return allOptions.slice(0, 10); // Show first 10 when empty
  return allOptions.filter(opt => opt.includes(query)).slice(0, 10);
});

// Keep the fzfSelect in sync with filtered options
createEffect(() => {
  const opts = filteredOptions();
  // Update option count so navigation works
  fzfSelect._setOptionCount(opts.length);
  // Register option values for selection
  fzfSelect._clearOptions();
  opts.forEach((opt, i) => fzfSelect._registerOption(i, opt));
});

// Focus first element
languageSelect.focus();

function App() {
  return (
    <box padding={1} gap={1}>
      {/* Header */}
      <text style={{ bold: true, color: "cyan" }}>
        Select Component Demo
      </text>
      <text style={{ dim: true }}>
        Tab/Shift+Tab to navigate | Up/Down or j/k to select | Ctrl+L for logs
      </text>

      {/* Form Section */}
      <box border="rounded" padding={1}>
        <text style={{ bold: true }}>Project Setup</text>
        <box height={1} />

        <box direction="row" gap={2}>
          {/* Language Select */}
          <box>
            <text style={{ dim: true }}>Language:</text>
            <select
              select={languageSelect}
              pointer={<text style={{ color: "cyan" }}>❯ </text>}
              pointerWidth={2}
              optionStyle={{ color: "white" }}
              selectedStyle={{ bold: true, color: "green", background: "blue" }}
            >
              <option value="typescript">TypeScript</option>
              <option value="javascript">JavaScript</option>
              <option value="rust">Rust</option>
              <option value="go">Go</option>
              <option value="python">Python</option>
            </select>
          </box>

          {/* Framework Select */}
          <box>
            <text style={{ dim: true }}>Framework:</text>
            <select
              select={frameworkSelect}
              pointer={<text style={{ color: "magenta" }}>→ </text>}
              pointerWidth={2}
              optionStyle={{ color: "white" }}
              selectedStyle={{ bold: true, color: "yellow", background: "magenta" }}
            >
              <option value="react">React</option>
              <option value="vue">Vue</option>
              <option value="svelte">Svelte</option>
              <option value="solid">Solid</option>
            </select>
          </box>

          {/* Project Name Input */}
          <box>
            <text style={{ dim: true }}>Name:</text>
            <box direction="row">
              <text>[</text>
              <input
                input={projectName}
                width={15}
                style={{ color: "white" }}
                cursorStyle={{ background: "cyan", color: "black" }}
                placeholderStyle={{ dim: true }}
              />
              <text>]</text>
            </box>
          </box>
        </box>

        <box height={1} />
        <text style={{ dim: true }}>
          Selected: {languageSelect.value()} + {frameworkSelect.value()} → {projectName.value() || "my-project"}
        </text>
      </box>

      {/* FZF Section */}
      <box border="rounded" padding={1}>
        <text style={{ bold: true }}>FZF-like Filtered Select</text>
        <text style={{ dim: true }}>
          Type to filter, Up/Down to navigate (directly selects)
        </text>
        <box height={1} />

        {/* Filter Input */}
        <box direction="row">
          <text style={{ color: "yellow" }}>{">"} </text>
          <input
            input={fzfInput}
            width={30}
            style={{ color: "white" }}
            cursorStyle={{ background: "yellow", color: "black" }}
            placeholderStyle={{ dim: true }}
          />
        </box>

        {/* Filtered Results */}
        <box>
          {filteredOptions().map((opt, i) => {
            const idx = fzfSelect.selectedIndex();
            const isSelected = idx !== -1 && idx === i;
            return (
              <text
                style={{
                  color: isSelected ? "green" : "white",
                  bold: isSelected,
                  background: isSelected ? "blue" : undefined,
                }}
              >
                {isSelected ? "❯ " : "  "}{opt}
              </text>
            );
          })}
          {filteredOptions().length === 0 && (
            <text style={{ dim: true }}>  No matches</text>
          )}
        </box>

        <box height={1} />
        <text style={{ dim: true }}>
          Selected fruit: {fzfSelect.value() || "(none)"}
        </text>
      </box>

      {/* Footer */}
      <text style={{ dim: true }}>Press Ctrl+C to exit</text>
    </box>
  );
}

// Simple run - focus manager handles everything!
// Only run when executed directly (not when imported for testing)
if (import.meta.main) {
  run(App);
}

// Export for testing
export { App, languageSelect, frameworkSelect, projectName, fzfInput, fzfSelect, filteredOptions };
