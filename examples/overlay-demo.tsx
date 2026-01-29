/**
 * Demo: Overlays with position absolute
 * Run with: bun examples/overlay-demo.tsx
 */

import {
  createSignal,
  focus,
  run,
  KEYS,
} from "../src/index.ts";

const [showModal, setShowModal] = createSignal(false);
const [modalPosition, setModalPosition] = createSignal({ x: 10, y: 5 });

function Modal() {
  const pos = modalPosition();

  return (
    <box
      position="absolute"
      x={pos.x}
      y={pos.y}
      width={30}
      height={10}
      border={true}
      style={{ background: "blue" }}
    >
      <box direction="column" padding={1}>
        <text style={{ color: "white", bold: true }}>Modal Dialog</text>
        <text style={{ color: "white" }}>This is an overlay!</text>
        <text style={{ color: "cyan" }}>Arrow keys to move</text>
        <text style={{ color: "yellow" }}>[Escape] to close</text>
      </box>
    </box>
  );
}

function App() {
  const modal = showModal();

  return (
    <box width={80} height={24}>
      {/* Background content */}
      <box direction="column" padding={1}>
        <text style={{ color: "green", bold: true }}>Overlay Demo</text>
        <text>This is the main content behind the modal.</text>
        <text>Press [M] to toggle modal, [Q] to quit.</text>

        <box margin={{ top: 2 }} direction="column">
          <text>Some background content here...</text>
          <text>Line 2 of background</text>
          <text>Line 3 of background</text>
          <text>Line 4 of background</text>
          <text>Line 5 of background</text>
        </box>
      </box>

      {/* Modal overlay */}
      {modal && <Modal />}
    </box>
  );
}

run(App, {
  onKeypress(key) {
    // Toggle modal
    if (key === "m" || key === "M") {
      setShowModal(!showModal());
      return;
    }

    // Close modal with Escape
    if (key === KEYS.ESCAPE && showModal()) {
      setShowModal(false);
      return;
    }

    // Move modal with arrow keys
    if (showModal()) {
      const pos = modalPosition();
      if (key === KEYS.UP) {
        setModalPosition({ ...pos, y: Math.max(0, pos.y - 1) });
        return;
      }
      if (key === KEYS.DOWN) {
        setModalPosition({ ...pos, y: pos.y + 1 });
        return;
      }
      if (key === KEYS.LEFT) {
        setModalPosition({ ...pos, x: Math.max(0, pos.x - 1) });
        return;
      }
      if (key === KEYS.RIGHT) {
        setModalPosition({ ...pos, x: pos.x + 1 });
        return;
      }
    }

    // Quit
    if (key === "q" || key === "Q") {
      return true; // exit
    }
  },
});
