import { f as o, p as a } from "./flowDb-c6c81e3f-B8SmAQpS.js";
import { f as t, a as e } from "./styles-d45a18b0-DyIYwln7.js";
import { n as s } from "./vendor-Dsy1-eqI.js";
import "./graph-vxD8NXqM.js";
import "./layout-CKZmpKt4.js";
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
