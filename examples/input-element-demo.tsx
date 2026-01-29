/**
 * Demo of the intrinsic <input> element with placeholder support.
 * Shows how the framework now handles cursor, placeholder styling, and focus automatically.
 */

import { run, createInput, createSignal, KEYS } from "../src/index.ts";

// Create two inputs with placeholders
const username = createInput({
  placeholder: "Enter your username...",
});

const email = createInput({
  placeholder: "your.email@example.com",
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
        • Tab to switch fields
      </text>
      <text style={{ dim: true }}>
        • Enter to submit
      </text>
      <text style={{ dim: true }}>
        • Shift+Enter for multiline (try it!)
      </text>
      <text style={{ dim: true }}>
        • Ctrl+C to quit
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

run(App, {
  onKeypress(key) {
    // Handle Tab to switch focus
    if (key === KEYS.TAB) {
      if (username.focused()) {
        email.focus();
      } else {
        username.focus();
      }
      return;
    }

    // Handle Enter to submit
    if (key === KEYS.ENTER) {
      setMessage(`Submitted:\n  Username: ${username.value()}\n  Email: ${email.value()}`);
      // Clear message after 2 seconds
      setTimeout(() => setMessage(""), 2000);
      return;
    }

    // Let focused input handle the key
    if (username.handleKey(key)) return;
    if (email.handleKey(key)) return;
  },
});
