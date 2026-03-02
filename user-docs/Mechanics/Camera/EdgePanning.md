# Camera Edge Panning

Edge panning lets the player move the world camera by parking the pointer at the outer rim of the application window. It offers hands-off scrolling while the HUD or embedded overlays are in focus and works alongside keyboard and trackpad motion.

## Player Experience

- Pan engages when the cursor touches the very edge of the window on any side (top, bottom, left, right). The HUD counts as part of the edge, so the pointer can rest over UI elements while still triggering motion.
- The farther the pointer sits inside the edge band, the faster the camera moves (quadratic easing). Moving the pointer back toward the centre cancels the pan immediately.
- Trackpad pans continue to work; when an overlay sits on the edge, pointer/scroll events are forwarded so the overlay remains interactive.
- Middle-click dragging is the direct alternative for manual camera motion; it works across overlays and snaps the cursor back to the default arrow as soon as the drag ends.

## Testing Guidance

- Move the pointer slowly toward each window edge and confirm pan acceleration feels smooth on all four sides.
- Hover over UI (top HUD, bottom HUD, browser or terminal overlays) near the edge to ensure the cursor keeps its expected icon and the camera still moves.
- Use a two-finger trackpad gesture that starts on an overlay sitting at an edge; the overlay should continue receiving scrolling while the camera pans as the pointer drifts into the edge strip.
- Verify that leaving the window (`pointerleave`) halts camera motion instantly.
