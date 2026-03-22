import { f as o, p as a } from "./flowDb-c6c81e3f-BBnYbulL.js";
import { f as t, g as e } from "./styles-d45a18b0-DE3tSg9L.js";
import { u as s } from "./vendor-r1U8Lk84.js";
import "./graph-DR1pQEcf.js";
import "./layout-KuBtXIJD.js";
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
