class Edit2dExtension extends Autodesk.Viewing.Extension {
  constructor(viewer, options) {
    super(viewer, options);
    this._onPolygonAdded = this._onPolygonAdded.bind(this);
  }

  async load() {
    this._edit2D = await this.viewer.loadExtension('Autodesk.Edit2D');
    this._edit2D.registerDefaultTools();

    this._edit2D.defaultTools.polygonTool.addEventListener(
      Autodesk.Edit2D.PolygonTool.POLYGON_ADDED,
      this._onPolygonAdded
    );

    console.log('Edit2dExtension loaded.');
    return true;
  }

  unload() {
    this._edit2D?.defaultTools.polygonTool.removeEventListener(
      Autodesk.Edit2D.PolygonTool.POLYGON_ADDED,
      this._onPolygonAdded
    );

    this._deactivateCurrentTool();

    if (this._group) {
      this.viewer.toolbar.removeControl(this._group);
      this._group = null;
    }

    console.log('Edit2dExtension unloaded.');
    return true;
  }

  onToolbarCreated() {
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
  }

  _activatePolygonTool() {
    this._deactivateCurrentTool();
    const tool = this._edit2D.defaultTools.polygonTool;
    this.viewer.toolController.activateTool(tool.getName());
  }

  _deactivateCurrentTool() {
    const active = this.viewer.toolController.getActiveTool();
    if (active && active.getName().startsWith('Edit2')) {
      active.selection?.clear();
      this.viewer.toolController.deactivateTool(active.getName());
    }
  }

  _onPolygonAdded(event) {
    const polygon = event.polygon;
    console.log('Polygon completed:', polygon);

    const points = [];
    if (polygon.vertexCount !== undefined) {
      for (let i = 0; i < polygon.vertexCount; i++) {
        const p = polygon.getPoint(i);
        points.push({ x: p.x.toFixed(2), y: p.y.toFixed(2) });
      }
    }

    console.table(points);
    this._showToast(`Polygon created with ${points.length} vertices`);

    if (this._drawBtn) {
      this._drawBtn.setState(Autodesk.Viewing.UI.Button.State.INACTIVE);
    }

    // Defer tool switch so finishPolygon() completes cleanly (this.poly = null)
    setTimeout(() => {
      const controller = this.viewer.toolController;
      controller.deactivateTool(this._edit2D.defaultTools.polygonTool.getName());
      controller.activateTool(this._edit2D.defaultTools.polygonEditTool.getName());
    }, 0);
  }

  _showToast(message) {
    let container = document.getElementById('edit2d-toast');
    if (!container) {
      container = document.createElement('div');
      container.id = 'edit2d-toast';
      Object.assign(container.style, {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#333',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: '6px',
        fontSize: '14px',
        zIndex: '10000',
        opacity: '0',
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none'
      });
      document.body.appendChild(container);
    }
    container.textContent = message;
    container.style.opacity = '1';
    setTimeout(() => {
      container.style.opacity = '0';
    }, 3000);
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension(
  'Edit2dExtension',
  Edit2dExtension
);
