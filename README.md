# aps-viewer-edit2d-sample

Custom extension leveraging the APS Viewer's Edit2D extension to create polygons, react to polygon creation events, and display area labels.

## Demo

[![APS Viewer Edit2D Sample](https://img.youtube.com/vi/9AG4Z0fB9Wk/0.jpg)](https://www.youtube.com/watch?v=9AG4Z0fB9Wk&feature=youtu.be)

## How it works

- Click the **Draw Polygon** toolbar button to activate the polygon drawing tool.
- Draw a polygon on the 2D sheet by clicking to place vertices, then press Enter, double-click, or click the first vertex to finish.
- On polygon creation the extension automatically:
  1. Attaches an **area label** (`Autodesk.Edit2D.ShapeLabel`) showing the polygon area.
  2. Switches to the **Edit** tool so you can reshape or move the polygon immediately.
- The area label updates in real time when the polygon is edited or moved.
- **Deleting a polygon also removes its area label** — see details below.

## Area labels

Each polygon gets a native `Autodesk.Edit2D.ShapeLabel` created in `_createAreaLabel()`:

```js
const label = new Autodesk.Edit2D.ShapeLabel(polygon, layer);
label.setText(this._formatArea(polygon));
```

Area is computed with `polygon.getArea(transform)` using `DefaultMeasureTransform` for correct unit scaling. When a `unitHandler` is available, the value is formatted via `unitHandler.areaToString()`.

### Label lifecycle

| Event | What happens |
|-------|-------------|
| `PolygonTool.POLYGON_ADDED` | `_createAreaLabel()` creates the `ShapeLabel` and stores it in `_labelMap` |
| `UndoStack.AFTER_ACTION` (shape still in layer) | `label.setText()` refreshes the area text after edits or moves |
| `UndoStack.AFTER_ACTION` (shape gone from layer) | `label.dtor()` destroys the label and removes it from `_labelMap` |
| Extension `unload()` | `_removeAllLabels()` destroys every remaining `ShapeLabel` |

The deletion detection uses a **reconciliation** approach: after every undo-stack action, the extension compares tracked label IDs against the shapes still present in the layer. Any label whose shape no longer exists is destroyed via `label.dtor()`. This handles delete, undo, redo, and `clearLayer` uniformly — without relying on action class names that may be mangled in minified viewer builds.

## Files

| File | Description |
|------|-------------|
| `index.html` | Main page that initializes the APS Viewer and loads the extension |
| `Edit2dExtension.js` | Custom extension that wraps Edit2D with event-driven polygon handling and area labels |

## Setup

Serve the files with any static HTTP server (e.g. `npx serve .` or VS Code Live Server) and open `index.html` in your browser.

## Key methods

| Method | Purpose |
|--------|---------|
| `_onPolygonAdded` | Reacts to `PolygonTool.POLYGON_ADDED` — creates the area label and switches to the edit tool |
| `_onAfterAction` | Reconciles labels on every `UndoStack.AFTER_ACTION` — destroys orphaned labels, refreshes area text for edited shapes |
| `_createAreaLabel` | Creates an `Autodesk.Edit2D.ShapeLabel` on the polygon with the formatted area |
| `_removeLabel` | Destroys a single `ShapeLabel` via `label.dtor()` |
| `_removeAllLabels` | Destroys all tracked `ShapeLabel` instances (called on unload) |
| `_formatArea` | Computes area with `polygon.getArea(transform)` and formats it with `unitHandler.areaToString()` |

## References

- [Edit2D Setup](https://aps.autodesk.com/en/docs/viewer/v7/developers_guide/advanced_options/edit2d-setup/)
- [Edit2D Use — Display Labels (Step 3)](https://aps.autodesk.com/en/docs/viewer/v7/developers_guide/advanced_options/edit2d-use/#step-3-display-labels)
- [Edit2D Manual](https://aps.autodesk.com/en/docs/viewer/v7/developers_guide/advanced_options/edit2d-manual/)
- [Edit2D Customize](https://aps.autodesk.com/en/docs/viewer/v7/developers_guide/advanced_options/edit2d-customize/)
