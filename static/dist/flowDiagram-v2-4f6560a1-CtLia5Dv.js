import { f as o, p as a } from "./flowDb-c6c81e3f-C6ZxBXH4.js";
import { f as t, g as e } from "./styles-d45a18b0-CQ_TF-7w.js";
import { u as s } from "./vendor-BCH5z7Ar.js";
import "./graph-DYX4N9mo.js";
import "./layout-D18PiUja.js";
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
