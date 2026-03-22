import { f as o, p as a } from "./flowDb-c6c81e3f-CeYT4cR5.js";
import { f as t, a as e } from "./styles-d45a18b0-CcklJbj9.js";
import { n as s } from "./vendor-CW5mw3QE.js";
import "./graph-U_MazhNF.js";
import "./layout-Cip0EEp5.js";
const p = {
  parser: a,
  db: o,
  renderer: e,
  styles: t,
  init: (r) => {
    r.flowchart || (r.flowchart = {}), r.flowchart.arrowMarkerAbsolute = r.arrowMarkerAbsolute, s({ flowchart: { arrowMarkerAbsolute: r.arrowMarkerAbsolute } }), e.setConf(r.flowchart), o.clear(), o.setGen("gen-2");
  }
};
export {
  p as diagram
};
