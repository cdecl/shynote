import { f as o, p as a } from "./flowDb-c6c81e3f-KWtzaYWp.js";
import { f as t, g as e } from "./styles-d45a18b0-tDFrWh1R.js";
import { u as s } from "./vendor-DsVEk2JX.js";
import "./graph-_roDoXmR.js";
import "./layout-DGIY8KSP.js";
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
