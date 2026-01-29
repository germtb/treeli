/**
 * Demo: Login form with inputs and button
 * Run with: bun examples/input-demo.tsx
 */

import {
  createSignal,
  createInput,
  createButton,
  defaultInputHandler,
  focus,
  run,
  KEYS,
} from "../src/index.ts";

// Messages
const [message, setMessage] = createSignal("");

// Create inputs - they auto-register with the focus manager
const usernameInput = createInput({
  onKeypress: (key, state) => {
    if (key === KEYS.ENTER) {
      focus.next(); // Move to next field
      return state;
    }
    if (key === KEYS.ESCAPE) return null; // bubble
    return defaultInputHandler(key, state);
  },
});

const passwordInput = createInput({
  mask: "*",
  onKeypress: (key, state) => {
    if (key === KEYS.ENTER) {
      focus.next(); // Move to button
      return state;
    }
    if (key === KEYS.ESCAPE) return null; // bubble
    return defaultInputHandler(key, state);
  },
});

// Create submit button
const submitButton = createButton({
  onPress: handleLogin,
});

// Focus first input
usernameInput.focus();

function handleLogin() {
  const user = usernameInput.value();
  const pass = passwordInput.value();

  if (!user || !pass) {
    setMessage("Please fill in both fields");
    return;
  }

  setMessage(`Logging in as ${user}...`);

  // Simulate login
  setTimeout(() => {
    setMessage(`Welcome, ${user}!`);
  }, 500);
}

// Render a text input field - full text shown, framework handles wrapping
function InputField(props: {
  label: string;
  input: ReturnType<typeof createInput>;
}) {
  const { label, input } = props;
  const isFocused = input.focused();
  const display = input.displayValue();
  const cursor = input.cursorPos();

  const labelColor = isFocused ? "cyan" : { rgb: [128, 128, 128] as [number, number, number] };
  const textColor = isFocused ? "white" : { rgb: [128, 128, 128] as [number, number, number] };

  // Split around cursor - show full text, let framework handle wrapping
  const beforeCursor = display.slice(0, cursor);
  const cursorChar = display[cursor] || " ";
  const afterCursor = display.slice(cursor + 1);

  return (
    <box direction="column">
      <text style={{ color: labelColor }}>{label}:</text>
      <box direction="row">
        <text style={{ color: textColor }}>{beforeCursor}</text>
        {isFocused && <text style={{ inverse: true }}>{cursorChar}</text>}
        {!isFocused && <text style={{ color: textColor }}>{cursorChar}</text>}
        <text style={{ color: textColor }}>{afterCursor}</text>
      </box>
    </box>
  );
}

// Render a button with rounded background and optional addOn (icon)
function Button(props: {
  button: ReturnType<typeof createButton>;
  label: string;
  addOn?: string;
  addOnPosition?: "left" | "right";
}) {
  const { button, label, addOn, addOnPosition = "left" } = props;
  const isFocused = button.focused();

  const background = isFocused ? "cyan" : { rgb: [60, 60, 60] as const };
  const color = isFocused ? "black" : "white";

  // Powerline semicircle characters (requires Nerd Font or similar)
  const leftCap = "\ue0b6";
  const rightCap = "\ue0b4";

  // Build content with addOn
  const leftAddOn = addOn && addOnPosition === "left" ? `${addOn} ` : "";
  const rightAddOn = addOn && addOnPosition === "right" ? ` ${addOn}` : "";
  const content = ` ${leftAddOn}${label}${rightAddOn} `;

  return (
    <box direction="row">
      <text style={{ color: background }}>{leftCap}</text>
      <text style={{ color, background, bold: isFocused }}>{content}</text>
      <text style={{ color: background }}>{rightCap}</text>
    </box>
  );
}

function App() {
  const msg = message();

  return (
    <box direction="column" gap={1} padding={1}>
      <text style={{ color: "yellow", bold: true }}>Login Form</text>

      <box direction="column" gap={1} margin={{ top: 1 }}>
        <InputField label="Username" input={usernameInput} />
        <InputField label="Password" input={passwordInput} />
        <box margin={{ top: 1, bottom: 1 }}>
          <Button button={submitButton} label="Submit" addOn="→" addOnPosition="right" />
        </box>
      </box>

      <text style={{ color: { rgb: [128, 128, 128] } }}>
        [Tab] Switch field  [Enter] Next/Submit  [Ctrl+C] Quit
      </text>

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
    // Focus manager handles Tab/Shift+Tab and routes to focused element
    if (focus.handleKey(key)) {
      return; // consumed
    }

    // Unhandled keys fall through here (e.g., global shortcuts)
  },
});
