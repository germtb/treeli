/**
 * Test the ACTUAL select-demo.tsx using the headless runner.
 * This imports the real App and verifies behavior on the buffer.
 */

import { describe, it, expect, afterEach, beforeEach } from "bun:test";
import { createHeadlessRunner, KEYS, focus } from "../src/index.ts";

// Import the actual select-demo components
import {
  App,
  languageSelect,
  frameworkSelect,
  projectName,
  fzfInput,
  fzfSelect,
} from "../examples/select-demo.tsx";

describe("actual select-demo.tsx", () => {
  let runner: ReturnType<typeof createHeadlessRunner> | null = null;

  beforeEach(() => {
    // Re-focus languageSelect before each test (it's only focused once at module load)
    languageSelect.focus();
    // Reset selectedIndex to 0
    languageSelect.setIndex(0);
  });

  afterEach(() => {
    runner?.dispose();
    runner = null;
  });

  it("renders the demo correctly", () => {
    runner = createHeadlessRunner(App);

    expect(runner.hasText("Select Component Demo")).toBe(true);
    expect(runner.hasText("Project Setup")).toBe(true);
    expect(runner.hasText("FZF-like Filtered Select")).toBe(true);
  });

  it("shows initial selections", () => {
    runner = createHeadlessRunner(App);

    // Check that typescript and react are shown (initial values)
    expect(runner.hasText("typescript")).toBe(true);
    expect(runner.hasText("react")).toBe(true);
  });

  it("Ctrl+L toggles log panel", () => {
    runner = createHeadlessRunner(App);

    expect(runner.isLogPanelVisible()).toBe(false);

    runner.pressKey(KEYS.CTRL_L);
    expect(runner.isLogPanelVisible()).toBe(true);
    expect(runner.hasText("Console")).toBe(true);

    runner.pressKey(KEYS.CTRL_L);
    expect(runner.isLogPanelVisible()).toBe(false);
  });

  it("Ctrl+K navigates up in select (fzf-style)", () => {
    runner = createHeadlessRunner(App);

    // languageSelect is focused, start at index 0
    expect(languageSelect.selectedIndex()).toBe(0);

    // Move down first
    runner.pressKey(KEYS.CTRL_J); // down
    expect(languageSelect.selectedIndex()).toBe(1);

    runner.pressKey(KEYS.CTRL_J); // down
    expect(languageSelect.selectedIndex()).toBe(2);

    // Now Ctrl+K should move up
    runner.pressKey(KEYS.CTRL_K); // up
    expect(languageSelect.selectedIndex()).toBe(1);

    runner.pressKey(KEYS.CTRL_K); // up
    expect(languageSelect.selectedIndex()).toBe(0);
  });

  it("Ctrl+K does not affect input text", () => {
    runner = createHeadlessRunner(App);

    // Tab to projectName (input)
    runner.pressKey(KEYS.TAB); // -> frameworkSelect
    runner.pressKey(KEYS.TAB); // -> projectName
    expect(focus.current()).toBe(projectName);

    // Type something
    runner.type("myapp");
    expect(projectName.value()).toBe("myapp");

    // Ctrl+K should NOT delete text (it's not handled by input anymore)
    runner.pressKey(KEYS.CTRL_K);
    expect(projectName.value()).toBe("myapp");
  });

  it("Ctrl+K clears logs when input is focused and logs visible", () => {
    runner = createHeadlessRunner(App);
    const capture = runner.getConsoleCapture()!;

    // Tab to projectName (input)
    runner.pressKey(KEYS.TAB); // -> frameworkSelect
    runner.pressKey(KEYS.TAB); // -> projectName
    expect(focus.current()).toBe(projectName);

    // Generate a log message
    console.log("Test message");
    expect(capture.getMessages().length).toBeGreaterThan(0);

    // Show logs and clear with Ctrl+K
    runner.pressKey(KEYS.CTRL_L);
    expect(runner.isLogPanelVisible()).toBe(true);

    runner.pressKey(KEYS.CTRL_K);
    expect(capture.getMessages().length).toBe(0);
  });

  it("navigation works - j/k moves selection in select", () => {
    runner = createHeadlessRunner(App);

    // languageSelect is focused, initial value is typescript (index 0)
    expect(languageSelect.selectedIndex()).toBe(0);

    // Press j to move down
    runner.pressKey("j");
    expect(languageSelect.selectedIndex()).toBe(1);

    // Press k to move up
    runner.pressKey("k");
    expect(languageSelect.selectedIndex()).toBe(0);
  });

  it("navigation works - Ctrl+J/Ctrl+K moves selection (fzf-style)", () => {
    runner = createHeadlessRunner(App);

    expect(languageSelect.selectedIndex()).toBe(0);

    // Ctrl+J moves down
    runner.pressKey(KEYS.CTRL_J);
    expect(languageSelect.selectedIndex()).toBe(1);

    // Ctrl+K moves up
    runner.pressKey(KEYS.CTRL_K);
    expect(languageSelect.selectedIndex()).toBe(0);
  });

  it("navigation works - Ctrl+N/Ctrl+P moves selection (emacs-style)", () => {
    runner = createHeadlessRunner(App);

    expect(languageSelect.selectedIndex()).toBe(0);

    // Ctrl+N moves down
    runner.pressKey(KEYS.CTRL_N);
    expect(languageSelect.selectedIndex()).toBe(1);

    // Ctrl+P moves up
    runner.pressKey(KEYS.CTRL_P);
    expect(languageSelect.selectedIndex()).toBe(0);
  });

  it("Tab cycles through demo focusables", () => {
    runner = createHeadlessRunner(App);

    // Start with languageSelect
    expect(focus.current()).toBe(languageSelect);

    // Tab through the 4 focusables in select-demo
    runner.pressKey(KEYS.TAB);
    expect(focus.current()).toBe(frameworkSelect);

    runner.pressKey(KEYS.TAB);
    expect(focus.current()).toBe(projectName);

    runner.pressKey(KEYS.TAB);
    expect(focus.current()).toBe(fzfInput);
  });
});
