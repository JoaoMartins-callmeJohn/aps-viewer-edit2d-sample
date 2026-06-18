class Edit2dExtension extends Autodesk.Viewing.Extension {
  constructor(viewer, options) {
    super(viewer, options);
    this._onPolygonAdded = this._onPolygonAdded.bind(this);
    this._onAfterAction = this._onAfterAction.bind(this);
    // Maps shape.id -> Autodesk.Edit2D.ShapeLabel
    this._labelMap = new Map();
  }

  async load() {
    this._edit2D = await this.viewer.loadExtension('Autodesk.Edit2D');
    this._edit2D.registerDefaultTools();

    this._edit2D.defaultTools.polygonTool.addEventListener(
      Autodesk.Edit2D.PolygonTool.POLYGON_ADDED,
      this._onPolygonAdded
    );

    // Reconcile labels on every undo-stack action (handles delete, undo, redo, clear)
    this._edit2D.defaultContext.undoStack.addEventListener(
      Autodesk.Edit2D.UndoStack.AFTER_ACTION,
      this._onAfterAction
    );

    if (this.viewer.toolbar) {
      this._createUI();
    }

    console.log('Edit2dExtension loaded.');
    return true;
  }

  unload() {
    this._edit2D?.defaultContext.undoStack.removeEventListener(
      Autodesk.Edit2D.UndoStack.AFTER_ACTION,
      this._onAfterAction
    );

    this._edit2D?.defaultTools.polygonTool.removeEventListener(
      Autodesk.Edit2D.PolygonTool.POLYGON_ADDED,
      this._onPolygonAdded
    );

    this._removeAllLabels();
    this._deactivateCurrentTool();

    if (this._group) {
      this.viewer.toolbar.removeControl(this._group);
      this._group = null;
    }

    console.log('Edit2dExtension unloaded.');
    return true;
  }

  onToolbarCreated() {
    this._createUI();
  }

  _createUI() {
    if (this._group) return;

    this._group = this.viewer.toolbar.getControl('Edit2dToolbar');
    if (!this._group) {
      this._group = new Autodesk.Viewing.UI.ControlGroup('Edit2dToolbar');
      this.viewer.toolbar.addControl(this._group);
    }

    const drawBtn = new Autodesk.Viewing.UI.Button('DrawPolygonBtn');
    drawBtn.onClick = () => {
      if (drawBtn.getState() === Autodesk.Viewing.UI.Button.State.ACTIVE) {
        this._deactivateCurrentTool();
        drawBtn.setState(Autodesk.Viewing.UI.Button.State.INACTIVE);
      } else {
        this._activatePolygonTool();
        drawBtn.setState(Autodesk.Viewing.UI.Button.State.ACTIVE);
      }
    };
    drawBtn.setToolTip('Draw Polygon');
    drawBtn.icon.classList.add('fas', 'fa-draw-polygon');
    this._group.addControl(drawBtn);
    this._drawBtn = drawBtn;

    const addProgBtn = new Autodesk.Viewing.UI.Button('AddProgPolygonBtn');
    addProgBtn.onClick = () => this._addPolygonProgrammatically();
    addProgBtn.setToolTip('Add Polygon Programmatically (repro)');
    addProgBtn.icon.classList.add('fas', 'fa-plus-square');
    this._group.addControl(addProgBtn);

    const addFixedBtn = new Autodesk.Viewing.UI.Button('AddFixedPolygonBtn');
    addFixedBtn.onClick = () => this._addPolygonFixed();
    addFixedBtn.setToolTip('Add Polygon Programmatically (fixed order)');
    addFixedBtn.icon.classList.add('fas', 'fa-check-square');
    this._group.addControl(addFixedBtn);
  }

  _activatePolygonTool() {
    this._deactivateCurrentTool();
    const tool = this._edit2D.defaultTools.polygonTool;
    this.viewer.toolController.activateTool(tool.getName());
  }

  _deactivateCurrentTool() {
    const active = this.viewer.toolController.getActiveTool();
    if (active && active.getName().startsWith('Edit2')) {
      try { active.selection?.clear(); } catch (_) { /* noop */ }
      this.viewer.toolController.deactivateTool(active.getName());
    }
  }

  _addPolygonProgrammatically() {
    const ctx = this._edit2D.defaultContext;

    this._removeAllLabels();
    ctx.clearLayer();

    // Use the current camera center so the polygon is visible on any sheet.
    const pos = this.viewer.navigation.getPosition();
    const s = 1.0;
    const coords = [
      { x: pos.x - s, y: pos.y - s },
      { x: pos.x + s, y: pos.y - s },
      { x: pos.x + s, y: pos.y + s },
      { x: pos.x - s, y: pos.y + s },
    ];

    const poly = new Autodesk.Edit2D.Polygon(coords);
    ctx.layer.addShape(poly);
    this._createAreaLabel(poly);

    // 0 ms forces tool activation in the very next event-loop tick —
    // most aggressive timing to surface the race condition.
    setTimeout(() => {
      const controller = this.viewer.toolController;
      const active = controller.getActiveTool();
      if (active && active.getName().startsWith('Edit2')) {
        controller.deactivateTool(active.getName());
      }
      controller.deactivateTool(this._edit2D.defaultTools.polygonTool.getName());

      controller.activateTool(this._edit2D.defaultTools.polygonEditTool.getName());
      ctx.selection.setSelection([]);
      ctx.selection.selectOnly(poly);
      ctx.layer.update();
      this.viewer.impl.invalidate(true, true, true);
    }, 0);
  }

  _addPolygonFixed() {
    const ctx = this._edit2D.defaultContext;

    this._removeAllLabels();
    ctx.clearLayer();

    const pos = this.viewer.navigation.getPosition();
    const s = 1.0;
    const coords = [
      { x: pos.x - s, y: pos.y - s },
      { x: pos.x + s, y: pos.y - s },
      { x: pos.x + s, y: pos.y + s },
      { x: pos.x - s, y: pos.y + s },
    ];

    const poly = new Autodesk.Edit2D.Polygon(coords);
    ctx.layer.addShape(poly);
    this._createAreaLabel(poly);

    // Flush the layer and request a render BEFORE activating the edit tool.
    // This ensures vertex positions are computed in screen space before
    // the tool's first pointer event fires.
    ctx.layer.update();
    this.viewer.impl.invalidate(true, true, true);

    setTimeout(() => {
      const controller = this.viewer.toolController;
      const active = controller.getActiveTool();
      if (active && active.getName().startsWith('Edit2')) {
        controller.deactivateTool(active.getName());
      }
      controller.deactivateTool(this._edit2D.defaultTools.polygonTool.getName());

      controller.activateTool(this._edit2D.defaultTools.polygonEditTool.getName());
      ctx.selection.setSelection([]);
      ctx.selection.selectOnly(poly);
    }, 50);
  }

  // --- Polygon creation callback (PolygonTool.POLYGON_ADDED) ---
  // Called after a polygon is fully committed to the layer.
  // Creates an area ShapeLabel and switches to the edit tool.
  _onPolygonAdded(event) {
    const polygon = event.polygon;
    console.log('Polygon completed:', polygon);

    try {
      this._createAreaLabel(polygon);
    } catch (err) {
      console.warn('Failed to create area label:', err);
    }

    if (this._drawBtn) {
      this._drawBtn.setState(Autodesk.Viewing.UI.Button.State.INACTIVE);
    }

    // Defer tool switch so finishPolygon() completes cleanly.
    // 100ms lets the closing-click event fully resolve before the edit tool activates.
    setTimeout(() => {
      const controller = this.viewer.toolController;
      controller.deactivateTool(this._edit2D.defaultTools.polygonTool.getName());
      controller.activateTool(this._edit2D.defaultTools.polygonEditTool.getName());
    }, 100);
  }

  // --- Undo-stack callback ---
  // After every action, reconcile: destroy labels whose shapes no longer
  // exist in the layer, and update area text for shapes that were edited.
  _onAfterAction() {
    try {
      if (this._labelMap.size === 0) return;

      const currentIds = new Set(
        this._edit2D.defaultContext.layer.shapes.map(s => s.id)
      );

      for (const [shapeId, label] of this._labelMap) {
        if (!currentIds.has(shapeId)) {
          // Shape was deleted — destroy its label
          try { label.dtor(); } catch (_) { /* noop */ }
          this._labelMap.delete(shapeId);
        } else {
          // Shape still exists — refresh area text (handles edits/moves)
          const shape = this._edit2D.defaultContext.layer.shapes.find(
            s => s.id === shapeId
          );
          if (shape) {
            label.setText(this._formatArea(shape));
          }
        }
      }
    } catch (err) {
      console.warn('_onAfterAction error:', err);
    }
  }

  // =========================================================================
  //  Area label creation
  //  Attaches an Autodesk.Edit2D.ShapeLabel to the polygon showing its area.
  // =========================================================================
  _createAreaLabel(polygon) {
    const layer = this._edit2D.defaultContext.layer;
    const label = new Autodesk.Edit2D.ShapeLabel(polygon, layer);
    label.setText(this._formatArea(polygon));
    this._labelMap.set(polygon.id, label);
  }

  // =========================================================================
  //  Area label removal
  //  Destroys the ShapeLabel and removes it from the tracking map.
  // =========================================================================
  _removeLabel(shapeId) {
    const label = this._labelMap.get(shapeId);
    if (!label) return;
    try { label.dtor(); } catch (_) { /* noop */ }
    this._labelMap.delete(shapeId);
  }

  // =========================================================================
  //  Remove all area labels (used on extension unload).
  // =========================================================================
  _removeAllLabels() {
    for (const [, label] of this._labelMap) {
      try { label.dtor(); } catch (_) { /* noop */ }
    }
    this._labelMap.clear();
  }

  // =========================================================================
  //  Format the polygon area as a display string.
  //  Uses DefaultMeasureTransform + unitHandler for correct units when
  //  available; falls back to raw model-unit value otherwise.
  // =========================================================================
  _formatArea(polygon) {
    try {
      if (typeof polygon.getArea !== 'function') return 'Area: —';

      const unitHandler = this._edit2D.defaultContext.unitHandler;
      const transform = unitHandler?.measureTransform
        || new Autodesk.Edit2D.DefaultMeasureTransform(this.viewer);
      const raw = polygon.getArea(transform);

      if (unitHandler && typeof unitHandler.areaToString === 'function') {
        return `Area: ${unitHandler.areaToString(raw)}`;
      }
      return `Area: ${raw.toFixed(2)}`;
    } catch (err) {
      console.warn('_formatArea error:', err);
      return 'Area: —';
    }
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension(
  'Edit2dExtension',
  Edit2dExtension
);
