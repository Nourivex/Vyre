// ANN adapter scaffold. Attempts to load an ANN native binding (hnswlib-node) if installed.
// If not available, exports `null` so callers can fallback to linear scan.

let ann: any = null;
try {
  // lazy require so project doesn't fail when native lib missing
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const HNSW = require('hnswlib-node');
  ann = HNSW;
} catch (e) {
  ann = null;
}

export function hasAnn() {
  return !!ann;
}

export default {
  hasAnn
};
