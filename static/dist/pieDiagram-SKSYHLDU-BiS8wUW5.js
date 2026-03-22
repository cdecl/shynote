import { aD as s, aF as U, aE as H, aG as J, aH as K, aY as V, aX as X, aJ as w, aI as Y, b6 as Z, ba as j, bb as q, aK as Q, b2 as ee, b8 as te } from "./vendor-CW5mw3QE.js";
import { p as ae } from "./chunk-4BX2VUAB-akHX38MJ.js";
import { p as re } from "./treemap-KZPCXAKY-C0qkw44J.js";
import { o as ie } from "./ordinal-B6-f3MAq.js";
import { d as G } from "./arc-BrAQLIjU.js";
import { d as se } from "./pie-IC_NQX2s.js";
var oe = te.pie, D = {
  sections: /* @__PURE__ */ new Map(),
  showData: !1
}, g = D.sections, C = D.showData, le = structuredClone(oe), ne = /* @__PURE__ */ s(() => structuredClone(le), "getConfig"), ce = /* @__PURE__ */ s(() => {
  g = /* @__PURE__ */ new Map(), C = D.showData, ee();
}, "clear"), de = /* @__PURE__ */ s(({ label: e, value: a }) => {
  if (a < 0)
    throw new Error(
      `"${e}" has invalid value: ${a}. Negative values are not allowed in pie charts. All slice values must be >= 0.`
    );
  g.has(e) || (g.set(e, a), w.debug(`added new section: ${e}, with value: ${a}`));
}, "addSection"), pe = /* @__PURE__ */ s(() => g, "getSections"), ge = /* @__PURE__ */ s((e) => {
  C = e;
}, "setShowData"), ue = /* @__PURE__ */ s(() => C, "getShowData"), W = {
  getConfig: ne,
  clear: ce,
  setDiagramTitle: X,
  getDiagramTitle: V,
  setAccTitle: K,
  getAccTitle: J,
  setAccDescription: H,
  getAccDescription: U,
  addSection: de,
  getSections: pe,
  setShowData: ge,
  getShowData: ue
}, fe = /* @__PURE__ */ s((e, a) => {
  ae(e, a), a.setShowData(e.showData), e.sections.map(a.addSection);
}, "populateDb"), he = {
  parse: /* @__PURE__ */ s(async (e) => {
    const a = await re("pie", e);
    w.debug(a), fe(a, W);
  }, "parse")
}, me = /* @__PURE__ */ s((e) => `
  .pieCircle{
    stroke: ${e.pieStrokeColor};
    stroke-width : ${e.pieStrokeWidth};
    opacity : ${e.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${e.pieOuterStrokeColor};
    stroke-width: ${e.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${e.pieTitleTextSize};
    fill: ${e.pieTitleTextColor};
    font-family: ${e.fontFamily};
  }
  .slice {
    font-family: ${e.fontFamily};
    fill: ${e.pieSectionTextColor};
    font-size:${e.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${e.pieLegendTextColor};
    font-family: ${e.fontFamily};
    font-size: ${e.pieLegendTextSize};
  }
`, "getStyles"), ve = me, Se = /* @__PURE__ */ s((e) => {
  const a = [...e.values()].reduce((r, o) => r + o, 0), $ = [...e.entries()].map(([r, o]) => ({ label: r, value: o })).filter((r) => r.value / a * 100 >= 1).sort((r, o) => o.value - r.value);
  return se().value((r) => r.value)($);
}, "createPieArcs"), xe = /* @__PURE__ */ s((e, a, $, y) => {
  w.debug(`rendering pie chart
` + e);
  const r = y.db, o = Y(), T = Z(r.getConfig(), o.pie), b = 40, l = 18, d = 4, c = 450, u = c, f = j(a), n = f.append("g");
  n.attr("transform", "translate(" + u / 2 + "," + c / 2 + ")");
  const { themeVariables: i } = o;
  let [A] = q(i.pieOuterStrokeWidth);
  A ??= 2;
  const E = T.textPosition, p = Math.min(u, c) / 2 - b, I = G().innerRadius(0).outerRadius(p), M = G().innerRadius(p * E).outerRadius(p * E);
  n.append("circle").attr("cx", 0).attr("cy", 0).attr("r", p + A / 2).attr("class", "pieOuterCircle");
  const h = r.getSections(), O = Se(h), P = [
    i.pie1,
    i.pie2,
    i.pie3,
    i.pie4,
    i.pie5,
    i.pie6,
    i.pie7,
    i.pie8,
    i.pie9,
    i.pie10,
    i.pie11,
    i.pie12
  ];
  let m = 0;
  h.forEach((t) => {
    m += t;
  });
  const _ = O.filter((t) => (t.data.value / m * 100).toFixed(0) !== "0"), v = ie(P);
  n.selectAll("mySlices").data(_).enter().append("path").attr("d", I).attr("fill", (t) => v(t.data.label)).attr("class", "pieCircle"), n.selectAll("mySlices").data(_).enter().append("text").text((t) => (t.data.value / m * 100).toFixed(0) + "%").attr("transform", (t) => "translate(" + M.centroid(t) + ")").style("text-anchor", "middle").attr("class", "slice"), n.append("text").text(r.getDiagramTitle()).attr("x", 0).attr("y", -400 / 2).attr("class", "pieTitleText");
  const k = [...h.entries()].map(([t, x]) => ({
    label: t,
    value: x
  })), S = n.selectAll(".legend").data(k).enter().append("g").attr("class", "legend").attr("transform", (t, x) => {
    const z = l + d, L = z * k.length / 2, N = 12 * l, B = x * z - L;
    return "translate(" + N + "," + B + ")";
  });
  S.append("rect").attr("width", l).attr("height", l).style("fill", (t) => v(t.label)).style("stroke", (t) => v(t.label)), S.append("text").attr("x", l + d).attr("y", l - d).text((t) => r.getShowData() ? `${t.label} [${t.value}]` : t.label);
  const R = Math.max(
    ...S.selectAll("text").nodes().map((t) => t?.getBoundingClientRect().width ?? 0)
  ), F = u + b + l + d + R;
  f.attr("viewBox", `0 0 ${F} ${c}`), Q(f, c, F, T.useMaxWidth);
}, "draw"), we = { draw: xe }, Ae = {
  parser: he,
  db: W,
  renderer: we,
  styles: ve
};
export {
  Ae as diagram
};
