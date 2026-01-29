/**
 * Debug test for input-demo rendering
 */

import { describe, expect, it, beforeEach } from "bun:test";
import { createSignal } from "../src/core/reactive.ts";
import { createInput, defaultInputHandler, KEYS } from "../src/core/input.ts";
import { focus } from "../src/core/focus.ts";
import { Renderer } from "../src/core/renderer.ts";
import { jsx } from "../src/jsx/jsx-runtime.ts";

describe("Input Demo Debug", () => {
  beforeEach(() => {
    focus.clear();
  });

  it("renders the full demo and simulates typing", () => {
    // Exactly like the demo
    const [activeField, setActiveField] = createSignal<"username" | "password">("username");
    const [message, setMessage] = createSignal("");

    const usernameInput = createInput({
      onKeypress: (key, state) => {
        if (key === KEYS.ENTER) return state;
        if (key === KEYS.ESCAPE) return null;
        return defaultInputHandler(key, state);
      },
    });

    const passwordInput = createInput({
      mask: "*",
      onKeypress: (key, state) => {
        if (key === KEYS.ENTER) return state;
        if (key === KEYS.ESCAPE) return null;
        return defaultInputHandler(key, state);
      },
    });

    usernameInput.focus();

    // InputField component
    function InputField(props: {
      label: string;
      input: ReturnType<typeof createInput>;
      active: boolean;
    }) {
      const { label, input, active } = props;
      const display = input.displayValue();
      const cursor = input.cursorPos();

      const beforeCursor = display.slice(0, cursor);
      const cursorChar = display[cursor] || " ";
      const afterCursor = display.slice(cursor + 1);

      return jsx("box", {
        direction: "row",
        gap: 1,
        children: [
          jsx("text", {
            style: { color: active ? "cyan" : "white" },
            children: `${label}:`,
          }),
          jsx("box", {
            direction: "row",
            width: 20,
            height: 1,
            children: [
              jsx("text", {
                style: { color: active ? "white" : "default" },
                children: beforeCursor,
              }),
              jsx("text", {
                style: { background: active ? "white" : "default", color: "black" },
                children: cursorChar,
              }),
              jsx("text", {
                style: { color: active ? "white" : "default" },
                children: afterCursor,
              }),
            ],
          }),
        ],
      });
    }

    function App() {
      const active = activeField();
      return jsx("box", {
        direction: "column",
        gap: 1,
        children: [
          jsx("text", {
            style: { color: "yellow", bold: true },
            children: "Login Form",
          }),
          InputField({
            label: "Username",
            input: usernameInput,
            active: active === "username",
          }),
          InputField({
            label: "Password",
            input: passwordInput,
            active: active === "password",
          }),
        ],
      });
    }

    const renderer = new Renderer({ width: 40, height: 10, output: () => {} });

    // Initial render
    renderer.render(App());
    let buffer = renderer.getCurrentBuffer();
    let output = buffer.toDebugString();

    console.log("=== Initial render ===");
    console.log(output);

    // Print each line with line numbers
    output.split("\n").forEach((line, i) => {
      console.log(`Line ${i}: "${line}"`);
    });
    console.log("---");

    // Check initial state
    expect(output).toContain("Login Form");
    expect(output).toContain("Username:");
    expect(output).toContain("Password:");

    // Find where Username: is rendered
    const lines = output.split("\n");
    let usernameLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.includes("Username:")) {
        usernameLineIdx = i;
        break;
      }
    }
    console.log("Username is on line:", usernameLineIdx);

    // Check cursor cell for username (should be white bg since active)
    // "Username:" is 9 chars, then gap of 1, so cursor starts at 10
    const usernameCursorCell = buffer.get(10, usernameLineIdx);
    console.log(`Username cursor cell at (10, ${usernameLineIdx}):`, usernameCursorCell);

    // Type in username
    usernameInput.handleKey("t");
    usernameInput.handleKey("e");
    usernameInput.handleKey("s");
    usernameInput.handleKey("t");

    renderer.render(App());
    buffer = renderer.getCurrentBuffer();
    output = buffer.toDebugString();

    console.log("=== After typing 'test' ===");
    output.split("\n").forEach((line, i) => {
      console.log(`Line ${i}: "${line}"`);
    });
    console.log("---");

    expect(output).toContain("test");

    // Find username line again
    const linesAfterTyping = output.split("\n");
    for (let i = 0; i < linesAfterTyping.length; i++) {
      if (linesAfterTyping[i]!.includes("Username:")) {
        usernameLineIdx = i;
        break;
      }
    }

    // Check the 't' character - should be after "Username: " which is 10 chars
    const tCell = buffer.get(10, usernameLineIdx);
    console.log(`'t' cell at (10, ${usernameLineIdx}):`, tCell);
    expect(tCell.char).toBe("t");

    // Check cursor after 'test' (position 14)
    const cursorAfterTest = buffer.get(14, usernameLineIdx);
    console.log(`Cursor after 'test' at (14, ${usernameLineIdx}):`, cursorAfterTest);
    expect(cursorAfterTest.style.background).toBe("white");

    // Switch to password field
    usernameInput.blur();
    passwordInput.focus();
    setActiveField("password");

    renderer.render(App());
    buffer = renderer.getCurrentBuffer();
    output = buffer.toDebugString();

    console.log("=== After switching to password ===");
    console.log(output);
    console.log("---");

    // Type password
    passwordInput.handleKey("s");
    passwordInput.handleKey("e");
    passwordInput.handleKey("c");

    renderer.render(App());
    buffer = renderer.getCurrentBuffer();
    output = buffer.toDebugString();

    console.log("=== After typing 'sec' in password ===");
    console.log(output);
    console.log("---");

    // Should show *** not sec
    expect(output).toContain("***");
    expect(output).not.toContain("sec");

    // Password value should be 'sec' but display should be '***'
    expect(passwordInput.value()).toBe("sec");
    expect(passwordInput.displayValue()).toBe("***");
  });
});
