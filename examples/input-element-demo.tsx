/**
 * Demo of the intrinsic <input> element with placeholder support.
 * Shows how the framework now handles cursor, placeholder styling, and focus automatically.
 */

import { run, createInput, createSignal, defaultInputHandler, KEYS } from "../src/index.ts";

// Create two inputs with placeholders
const username = createInput({
  placeholder: "Enter your username...",
  onKeypress: (key, state) => {
    if (key === KEYS.ENTER) {
      // Submit on Enter
      setMessage(`Submitted:\n  Username: ${state.value}\n  Email: ${email.value()}`);
      setTimeout(() => setMessage(""), 2000);
      return state; // consume key
    }
    return defaultInputHandler(key, state);
  },
});

const email = createInput({
  placeholder: "your.email@example.com",
  onKeypress: (key, state) => {
    if (key === KEYS.ENTER) {
      // Submit on Enter
      setMessage(`Submitted:\n  Username: ${username.value()}\n  Email: ${state.value}`);
      setTimeout(() => setMessage(""), 2000);
      return state; // consume key
    }
    return defaultInputHandler(key, state);
  },
});

// Message state
const [message, setMessage] = createSignal("");

// Start with username focused
username.focus();

function App() {
  const msg = message();

  return (
    <box padding={2} gap={1}>
      <text style={{ color: "cyan", bold: true }}>Registration Form</text>
      <text />

      <box direction="row" gap={1}>
        <text style={{ color: "yellow" }}>Username:</text>
        <input input={username} />
      </box>

      <box direction="row" gap={1}>
        <text style={{ color: "yellow" }}>Email:   </text>
        <input input={email} />
      </box>

      <text />
      <text style={{ dim: true }}>
        Tab to switch fields
      </text>
      <text style={{ dim: true }}>
        Enter to submit
      </text>
      <text style={{ dim: true }}>
        Shift+Enter for multiline (try it!)
      </text>
      <text style={{ dim: true }}>
        Ctrl+C to quit
      </text>

      {msg && (
        <>
          <text />
          <text style={{ color: "green" }}>{msg}</text>
        </>
      )}
    </box>
  );
}

// Focus manager handles everything automatically!
run(App);
