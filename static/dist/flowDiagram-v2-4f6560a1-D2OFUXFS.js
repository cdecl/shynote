import { f as o, p as a } from "./flowDb-c6c81e3f-BQf_hoMM.js";
import { f as t, g as e } from "./styles-d45a18b0-BHRBLqMo.js";
import { u as s } from "./vendor-BoF2JRZw.js";
import "./graph-B8je_xJE.js";
import "./layout-C0zNKVM_.js";
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
