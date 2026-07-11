/** Inputs for computePanelRegion */
export interface PanelRegionOptions {
  /** Terminal width in columns */
  termCols: number;
  /** Terminal height in rows */
  termRows: number;
  /** Source frame width in pixels */
  sourceWidth: number;
  /** Source frame height in pixels */
  sourceHeight: number;
}

/** Inputs for computeEmbeddedRegion */
export interface EmbeddedRegionOptions {
  /** Panel box width in terminal cells */
  cols: number;
  /** Panel box height in terminal cells */
  rows: number;
  /** Source frame width in pixels */
  sourceWidth: number;
  /** Source frame height in pixels */
  sourceHeight: number;
}
