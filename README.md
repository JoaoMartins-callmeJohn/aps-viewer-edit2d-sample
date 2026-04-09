# aps-viewer-edit2d-sample

Custom extension leveraging the APS Viewer's Edit2D extension to create polygons and react to polygon creation events.

## How it works

- Click the **Draw Polygon** toolbar button to activate the polygon drawing tool.
- Draw a polygon on the 2D sheet by clicking to place vertices, then double-click or close the shape to finish.
- On polygon creation, the extension automatically:
  1. Logs the polygon vertices to the console.
  2. Shows a toast notification with the vertex count.
  3. Deactivates the draw tool and switches to the **Move** tool so you can reposition the polygon.
- The extension listens to `Autodesk.Edit2D.UndoStack.AFTER_ACTION` to detect when shapes are added, instead of requiring separate toolbar buttons for draw/edit/move.

## Files

| File | Description |
|------|-------------|
| `index.html` | Main page that initializes the APS Viewer and loads the extension |
| `Edit2dExtension.js` | Custom extension that wraps Edit2D with event-driven polygon handling |

## Setup

Serve the files with any static HTTP server (e.g. `npx serve .` or VS Code Live Server) and open `index.html` in your browser.

## References

- [Edit2D Setup](https://aps.autodesk.com/en/docs/viewer/v7/developers_guide/advanced_options/edit2d-setup/)
- [Edit2D Use](https://aps.autodesk.com/en/docs/viewer/v7/developers_guide/advanced_options/edit2d-use/)
- [Edit2D Manual](https://aps.autodesk.com/en/docs/viewer/v7/developers_guide/advanced_options/edit2d-manual/)
- [Edit2D Customize](https://aps.autodesk.com/en/docs/viewer/v7/developers_guide/advanced_options/edit2d-customize/)
