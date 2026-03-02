import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import Canvas from '../../../src/renderer/components/canvas/Canvas';
import { useCanvasTransform } from '../../../src/renderer/components/canvas/CanvasContext';

const noop = () => {};

afterEach(() => {
  cleanup();
});

describe('Canvas input rules', () => {
  describe('drag selection threshold', () => {
    test('does not trigger selection for movement below threshold', () => {
      const onSelectionStart = vi.fn();
      const onSelectionEnd = vi.fn();
      const onSelectionCancel = vi.fn();

      const { getByTestId } = render(
        <Canvas
          onClickEmpty={noop}
          onSelectionStart={onSelectionStart}
          onSelectionEnd={onSelectionEnd}
          onSelectionCancel={onSelectionCancel}
          selectionDragThresholdPx={5}
        >
          <div />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');

      fireEvent.mouseDown(canvas, { button: 0, clientX: 100, clientY: 100 });
      fireEvent.mouseMove(document, { clientX: 102, clientY: 102 });
      fireEvent.mouseUp(document, { clientX: 102, clientY: 102 });

      expect(onSelectionStart).toHaveBeenCalled();
      expect(onSelectionEnd).not.toHaveBeenCalled();
      expect(onSelectionCancel).toHaveBeenCalled();
    });

    test('triggers selection for movement above threshold', () => {
      const onSelectionEnd = vi.fn();

      const { getByTestId } = render(
        <Canvas onClickEmpty={noop} onSelectionEnd={onSelectionEnd} selectionDragThresholdPx={5}>
          <div />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');

      fireEvent.mouseDown(canvas, { button: 0, clientX: 100, clientY: 100 });
      fireEvent.mouseMove(document, { clientX: 110, clientY: 110 });
      fireEvent.mouseUp(document, { clientX: 110, clientY: 110 });

      expect(onSelectionEnd).toHaveBeenCalled();
    });
  });

  describe('modifier keys for additive selection', () => {
    test('passes additive=true when metaKey is pressed (Mac Cmd)', () => {
      const onSelectionEnd = vi.fn();

      const { getByTestId } = render(
        <Canvas onClickEmpty={noop} onSelectionEnd={onSelectionEnd} selectionDragThresholdPx={5}>
          <div />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');

      fireEvent.mouseDown(canvas, { button: 0, clientX: 100, clientY: 100 });
      fireEvent.mouseMove(document, { clientX: 120, clientY: 120 });
      fireEvent.mouseUp(document, { clientX: 120, clientY: 120, metaKey: true });

      expect(onSelectionEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          additive: true,
        })
      );
    });

    test('passes additive=true when ctrlKey is pressed (Windows/Linux Ctrl)', () => {
      const onSelectionEnd = vi.fn();

      const { getByTestId } = render(
        <Canvas onClickEmpty={noop} onSelectionEnd={onSelectionEnd} selectionDragThresholdPx={5}>
          <div />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');

      fireEvent.mouseDown(canvas, { button: 0, clientX: 100, clientY: 100 });
      fireEvent.mouseMove(document, { clientX: 120, clientY: 120 });
      fireEvent.mouseUp(document, { clientX: 120, clientY: 120, ctrlKey: true });

      expect(onSelectionEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          additive: true,
        })
      );
    });

    test('passes additive=false when no modifier key is pressed', () => {
      const onSelectionEnd = vi.fn();

      const { getByTestId } = render(
        <Canvas onClickEmpty={noop} onSelectionEnd={onSelectionEnd} selectionDragThresholdPx={5}>
          <div />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');

      fireEvent.mouseDown(canvas, { button: 0, clientX: 100, clientY: 100 });
      fireEvent.mouseMove(document, { clientX: 120, clientY: 120 });
      fireEvent.mouseUp(document, { clientX: 120, clientY: 120 });

      expect(onSelectionEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          additive: false,
        })
      );
    });
  });

  describe('panning controls', () => {
    test('initiates panning with middle mouse button', () => {
      const { getByTestId } = render(
        <Canvas onClickEmpty={noop}>
          <div />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');

      fireEvent.mouseDown(canvas, { button: 1, clientX: 100, clientY: 100 });

      expect(canvas.classList.contains('panning')).toBe(true);
    });

    test('initiates panning with shift + right click', () => {
      const { getByTestId } = render(
        <Canvas onClickEmpty={noop}>
          <div />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');

      fireEvent.mouseDown(canvas, { button: 2, shiftKey: true, clientX: 100, clientY: 100 });

      expect(canvas.classList.contains('panning')).toBe(true);
    });

    test('does not initiate panning with regular right click', () => {
      const { getByTestId } = render(
        <Canvas onClickEmpty={noop}>
          <div />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');

      fireEvent.mouseDown(canvas, { button: 2, shiftKey: false, clientX: 100, clientY: 100 });

      expect(canvas.classList.contains('panning')).toBe(false);
    });
  });

  describe('right-click handling', () => {
    test('calls onRightClick with world position', () => {
      const onRightClick = vi.fn();

      const { getByTestId } = render(
        <Canvas onClickEmpty={noop} onRightClick={onRightClick}>
          <div />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');

      fireEvent.contextMenu(canvas, { clientX: 200, clientY: 150 });

      expect(onRightClick).toHaveBeenCalled();
      const [position] = onRightClick.mock.calls[0];
      expect(position).toHaveProperty('x');
      expect(position).toHaveProperty('y');
    });

    test('does not trigger onRightClick when shift is held', () => {
      const onRightClick = vi.fn();

      const { getByTestId } = render(
        <Canvas onClickEmpty={noop} onRightClick={onRightClick}>
          <div />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');

      fireEvent.contextMenu(canvas, { clientX: 200, clientY: 150, shiftKey: true });

      expect(onRightClick).not.toHaveBeenCalled();
    });
  });

  describe('wheel input', () => {
    test('trackpad pan does not rerender zoom context consumers', async () => {
      const onCameraChange = vi.fn();
      const zoomRenderSpy = vi.fn();

      const ZoomConsumer = () => {
        const { zoom } = useCanvasTransform();
        zoomRenderSpy(zoom);
        return <div data-testid="zoom-consumer">{zoom}</div>;
      };

      const { getByTestId } = render(
        <Canvas onClickEmpty={noop} onCameraChange={onCameraChange}>
          <ZoomConsumer />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');
      await waitFor(() => {
        expect(zoomRenderSpy.mock.calls.length).toBeGreaterThan(0);
      });
      const baselineRenders = zoomRenderSpy.mock.calls.length;

      fireEvent.wheel(canvas, { deltaMode: 0, deltaX: 10, deltaY: 12, clientX: 0, clientY: 0 });
      fireEvent.wheel(canvas, { deltaMode: 0, deltaX: 14, deltaY: 8, clientX: 0, clientY: 0 });

      await waitFor(() => {
        const lastCall = onCameraChange.mock.calls.at(-1)?.[0];
        expect(lastCall?.zoom).toBe(1);
        expect(zoomRenderSpy.mock.calls.length).toBe(baselineRenders);
      });
    });

    test('batches camera updates to one callback per animation frame', async () => {
      vi.useFakeTimers();
      const rafMock = vi
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation((callback: FrameRequestCallback) =>
          window.setTimeout(() => callback(performance.now()), 16)
        );
      const cancelRafMock = vi
        .spyOn(window, 'cancelAnimationFrame')
        .mockImplementation((id: number) => window.clearTimeout(id));
      try {
        const onCameraChange = vi.fn();
        const { getByTestId } = render(
          <Canvas onClickEmpty={noop} onCameraChange={onCameraChange}>
            <div />
          </Canvas>
        );

        await vi.advanceTimersByTimeAsync(20);
        onCameraChange.mockClear();

        const canvas = getByTestId('workspace-canvas');
        fireEvent.wheel(canvas, { deltaMode: 0, deltaX: 10, deltaY: 14, clientX: 0, clientY: 0 });
        fireEvent.wheel(canvas, { deltaMode: 0, deltaX: 12, deltaY: 10, clientX: 0, clientY: 0 });

        expect(onCameraChange).toHaveBeenCalledTimes(0);

        await vi.advanceTimersByTimeAsync(40);
        expect(onCameraChange).toHaveBeenCalledTimes(1);
      } finally {
        rafMock.mockRestore();
        cancelRafMock.mockRestore();
        vi.useRealTimers();
      }
    });

    test('trackpad scroll pans instead of zooming', async () => {
      const onCameraChange = vi.fn();

      const { getByTestId } = render(
        <Canvas onClickEmpty={noop} onCameraChange={onCameraChange}>
          <div />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');

      fireEvent.wheel(canvas, { deltaMode: 0, deltaX: 12, deltaY: 24, clientX: 0, clientY: 0 });

      await waitFor(() => {
        const lastCall = onCameraChange.mock.calls.at(-1)?.[0];
        expect(lastCall?.zoom).toBe(1);
        expect(lastCall?.pan).toEqual({ x: -18, y: -36 });
      });
    });

    test('windowed building captures wheel when active', async () => {
      const onCameraChange = vi.fn();

      const { getByTestId } = render(
        <Canvas onClickEmpty={noop} onCameraChange={onCameraChange}>
          <div className="windowed-building">
            <div data-testid="windowed-content" />
          </div>
        </Canvas>
      );

      const target = getByTestId('windowed-content');
      await waitFor(() => {
        expect(onCameraChange).toHaveBeenCalled();
      });
      const initialCalls = onCameraChange.mock.calls.length;

      fireEvent.wheel(target, { deltaMode: 0, deltaX: 0, deltaY: 120, clientX: 0, clientY: 0 });

      await waitFor(() => {
        expect(onCameraChange.mock.calls.length).toBe(initialCalls);
      });
    });

    test('ctrl+wheel over canvas is prevented', () => {
      const { getByTestId } = render(
        <Canvas onClickEmpty={noop}>
          <div />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');
      const event = new WheelEvent('wheel', {
        deltaX: 0,
        deltaY: -10,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      canvas.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    test('calls onWheelPanActivity for trackpad pan only', async () => {
      const onCameraChange = vi.fn();
      const onWheelPanActivity = vi.fn();

      const { getByTestId } = render(
        <Canvas onClickEmpty={noop} onCameraChange={onCameraChange} onWheelPanActivity={onWheelPanActivity}>
          <div />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');

      fireEvent.wheel(canvas, { deltaMode: 0, deltaX: 10, deltaY: 12, clientX: 0, clientY: 0 });
      fireEvent.wheel(canvas, { deltaMode: 0, deltaX: 0, deltaY: 120, clientX: 0, clientY: 0 });

      await waitFor(() => {
        expect(onWheelPanActivity).toHaveBeenCalledTimes(1);
      });
    });

    test('batches onWheelPanActivity to once per animation frame', async () => {
      vi.useFakeTimers();
      const rafMock = vi
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation((callback: FrameRequestCallback) =>
          window.setTimeout(() => callback(performance.now()), 16)
        );
      const cancelRafMock = vi
        .spyOn(window, 'cancelAnimationFrame')
        .mockImplementation((id: number) => window.clearTimeout(id));

      try {
        const onWheelPanActivity = vi.fn();
        const { getByTestId } = render(
          <Canvas onClickEmpty={noop} onWheelPanActivity={onWheelPanActivity}>
            <div />
          </Canvas>
        );

        const canvas = getByTestId('workspace-canvas');
        fireEvent.wheel(canvas, { deltaMode: 0, deltaX: 10, deltaY: 12, clientX: 0, clientY: 0 });
        fireEvent.wheel(canvas, { deltaMode: 0, deltaX: 14, deltaY: 8, clientX: 0, clientY: 0 });
        fireEvent.wheel(canvas, { deltaMode: 0, deltaX: 12, deltaY: 10, clientX: 0, clientY: 0 });

        expect(onWheelPanActivity).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(20);

        fireEvent.wheel(canvas, { deltaMode: 0, deltaX: 9, deltaY: 11, clientX: 0, clientY: 0 });
        expect(onWheelPanActivity).toHaveBeenCalledTimes(2);
      } finally {
        rafMock.mockRestore();
        cancelRafMock.mockRestore();
        vi.useRealTimers();
      }
    });

    test('pinch zoom does not trigger trackpad pan continuation', async () => {
      const onWheelPanActivity = vi.fn();

      const { getByTestId } = render(
        <Canvas onClickEmpty={noop} onWheelPanActivity={onWheelPanActivity}>
          <div />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');

      fireEvent.wheel(canvas, { deltaMode: 0, deltaX: 8, deltaY: 10, clientX: 0, clientY: 0 });
      fireEvent.wheel(canvas, { deltaMode: 0, deltaX: 0, deltaY: -4, ctrlKey: true, clientX: 0, clientY: 0 });

      await waitFor(() => {
        expect(onWheelPanActivity).toHaveBeenCalledTimes(1);
      });
    });

    test('mouse wheel zooms instead of panning', async () => {
      const onCameraChange = vi.fn();

      const { getByTestId } = render(
        <Canvas onClickEmpty={noop} onCameraChange={onCameraChange}>
          <div />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');

      fireEvent.wheel(canvas, { deltaMode: 0, deltaX: 0, deltaY: 120, clientX: 0, clientY: 0 });

      await waitFor(() => {
        const lastCall = onCameraChange.mock.calls.at(-1)?.[0];
        expect(lastCall?.zoom).toBeCloseTo(0.85, 4);
        expect(lastCall?.pan).toEqual({ x: 0, y: 0 });
      });
    });

    test('pinch zoom keeps zoom behavior on trackpad', async () => {
      const onCameraChange = vi.fn();

      const { getByTestId } = render(
        <Canvas onClickEmpty={noop} onCameraChange={onCameraChange}>
          <div />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');

      fireEvent.wheel(canvas, {
        deltaMode: 0,
        deltaX: 0,
        deltaY: -10,
        ctrlKey: true,
        clientX: 0,
        clientY: 0,
      });

      await waitFor(() => {
        const lastCall = onCameraChange.mock.calls.at(-1)?.[0];
        expect(lastCall?.zoom).toBeGreaterThan(1);
      });
    });
  });

  describe('selection rectangle coordinates', () => {
    test('provides correct rect coordinates in selection callbacks', () => {
      const onSelectionEnd = vi.fn();

      const { getByTestId } = render(
        <Canvas onClickEmpty={noop} onSelectionEnd={onSelectionEnd} selectionDragThresholdPx={0}>
          <div />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');

      fireEvent.mouseDown(canvas, { button: 0, clientX: 100, clientY: 100 });
      fireEvent.mouseMove(document, { clientX: 200, clientY: 150 });
      fireEvent.mouseUp(document, { clientX: 200, clientY: 150 });

      expect(onSelectionEnd).toHaveBeenCalled();
      const { rect, dragStart, dragEnd } = onSelectionEnd.mock.calls[0][0];

      expect(rect.left).toBe(100);
      expect(rect.right).toBe(200);
      expect(rect.top).toBe(100);
      expect(rect.bottom).toBe(150);
      expect(dragStart).toEqual({ x: 100, y: 100 });
      expect(dragEnd).toEqual({ x: 200, y: 150 });
    });

    test('normalizes rect when dragging bottom-right to top-left', () => {
      const onSelectionEnd = vi.fn();

      const { getByTestId } = render(
        <Canvas onClickEmpty={noop} onSelectionEnd={onSelectionEnd} selectionDragThresholdPx={0}>
          <div />
        </Canvas>
      );

      const canvas = getByTestId('workspace-canvas');

      fireEvent.mouseDown(canvas, { button: 0, clientX: 200, clientY: 150 });
      fireEvent.mouseMove(document, { clientX: 100, clientY: 100 });
      fireEvent.mouseUp(document, { clientX: 100, clientY: 100 });

      expect(onSelectionEnd).toHaveBeenCalled();
      const { rect } = onSelectionEnd.mock.calls[0][0];

      expect(rect.left).toBe(100);
      expect(rect.right).toBe(200);
      expect(rect.top).toBe(100);
      expect(rect.bottom).toBe(150);
    });
  });
});
