import { f as o, p as a } from "./flowDb-c6c81e3f-DHv5l-9t.js";
import { f as t, g as e } from "./styles-d45a18b0-D64HUCkC.js";
import { u as s } from "./vendor-T05Wpcog.js";
import "./graph-BvIvwu10.js";
import "./layout-0immzEoq.js";
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
