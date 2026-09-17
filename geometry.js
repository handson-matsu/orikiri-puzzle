/* Pure geometry. Coordinates use the original 100 × 100 square, y points down.
 * A fold reflects the chosen half-plane about a directed line.
 * Each leaf retains its ORIGINAL polygon and every intermediate affine map.
 * Cut polygons are clipped to the folded leaf, then mapped back to its original
 * coordinates. The renderer and the correct choice use these exact same cuts.
 */
(function (root) {
  'use strict';
  const EPS = 1e-8;
  const square = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const identity = [1, 0, 0, 1, 0, 0];
  const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const area = p => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - a[1] * b[0]; }, 0)) / 2;
  const point = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
  const map = (m, p) => p.map(v => point(m, v));
  function compose(a, b) {
    return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
  }
  function inverse(m) {
    const d = m[0]*m[3]-m[1]*m[2];
    const a = [m[3]/d, -m[1]/d, -m[2]/d, m[0]/d, 0, 0];
    a[4] = -a[0]*m[4]-a[2]*m[5]; a[5] = -a[1]*m[4]-a[3]*m[5]; return a;
  }
  function reflection({ line: [a, b] }) {
    const dx = b[0]-a[0], dy = b[1]-a[1], d = dx*dx+dy*dy;
    if (d < EPS) throw new Error('Fold line must have two distinct endpoints');
    const u = (dx*dx-dy*dy)/d, v = 2*dx*dy/d;
    return [u, v, v, -u, a[0]-u*a[0]-v*a[1], a[1]-v*a[0]+u*a[1]];
  }
  function clip(poly, a, b, side = 1) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i+1)%poly.length];
      const dp = cross(a,b,p)*side, dq = cross(a,b,q)*side;
      if (dp >= -EPS) out.push(p);
      if ((dp > EPS && dq < -EPS) || (dp < -EPS && dq > EPS)) {
        const t = dp/(dp-dq); out.push([p[0]+t*(q[0]-p[0]), p[1]+t*(q[1]-p[1])]);
      }
    }
    return out.filter((p,i) => !i || Math.hypot(p[0]-out[i-1][0],p[1]-out[i-1][1]) > EPS);
  }
  function intersect(poly, boundary) {
    const signed = boundary.reduce((s,a,i) => { const b=boundary[(i+1)%boundary.length]; return s+a[0]*b[1]-a[1]*b[0]; },0);
    return boundary.reduce((p,a,i) => clip(p,a,boundary[(i+1)%boundary.length],signed >= 0 ? 1 : -1),poly);
  }
  function contains(polygon, p) {
    const signs = polygon.map((a,i)=>cross(a,polygon[(i+1)%polygon.length],p));
    return signs.every(v=>v>=-EPS) || signs.every(v=>v<=EPS);
  }
  function compile(question) {
    let leaves = [{ polygon: square, matrices: [identity], moving: [] }];
    question.folds.forEach(fold => {
      const reflect = reflection(fold), next = [];
      for (const leaf of leaves) {
        const m = leaf.matrices.at(-1), current = map(m, leaf.polygon);
        for (const moving of [false, true]) {
          const piece = clip(current, ...fold.line, moving ? fold.side : -fold.side);
          if (piece.length < 3 || area(piece) < EPS) continue;
          next.push({ polygon: map(inverse(m),piece), matrices: [...leaf.matrices,moving ? compose(reflect,m) : m], moving: [...leaf.moving,moving] });
        }
      }
      leaves = next;
    });
    for (const leaf of leaves) {
      const m = leaf.matrices.at(-1), folded = map(m,leaf.polygon);
      leaf.cuts = question.cuts.map((cut, index) => ({ index, folded: intersect(cut.polygon,folded) }))
        .filter(cut => cut.folded.length >= 3 && area(cut.folded) > EPS)
        .map(cut => ({ ...cut, original: map(inverse(m),cut.folded) }));
    }
    const packet = leaves.map(leaf=>map(leaf.matrices.at(-1),leaf.polygon));
    const onPaper = p => packet.some(polygon=>contains(polygon,p));
    for (const leaf of leaves) for (const cut of leaf.cuts) {
      const source = question.cuts[cut.index].polygon;
      cut.edges = [];
      cut.folded.forEach((a,i)=>{
        const b=cut.folded[(i+1)%cut.folded.length], dx=b[0]-a[0], dy=b[1]-a[1], length=Math.hypot(dx,dy);
        if(length<EPS)return;
        const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
        const rawBoundary=source.some((p,j)=>Math.abs(cross(p,source[(j+1)%source.length],mid))<EPS);
        const offset=[-dy/length*.001,dx/length*.001];
        if(rawBoundary && onPaper([mid[0]+offset[0],mid[1]+offset[1]]) && onPaper([mid[0]-offset[0],mid[1]-offset[1]]))
          cut.edges.push(map(inverse(leaf.matrices.at(-1)),[a,b]));
      });
    }
    return { leaves, question, holes: leaves.flatMap(leaf => leaf.cuts.map(cut => cut.original)) };
  }
  // Misconceptions are explicit inverse-operation variants, never random artwork.
  function candidate(model, spec = {}) {
    if (spec.cuts) return compile({ ...model.question, cuts: spec.cuts }).holes;
    return model.leaves.flatMap(leaf => leaf.cuts.map(cut => {
      let polygon = cut.folded;
      for (let i = model.question.folds.length-1; i >= 0; i--) {
        if (!leaf.moving[i] || (spec.skip || []).includes(i)) continue;
        const matrix = reflection(spec.axes?.[i] || model.question.folds[i]);
        if ((spec.translate || []).includes(i)) {
          const center = polygon.reduce((p,v)=>[p[0]+v[0]/polygon.length,p[1]+v[1]/polygon.length],[0,0]);
          const to = point(matrix,center);
          polygon = polygon.map(p=>[p[0]+to[0]-center[0],p[1]+to[1]-center[1]]);
        } else polygon = map(matrix,polygon);
      }
      return polygon;
    }));
  }
  const path = poly => poly.length ? `M${poly.map(p=>p.map(v=>+v.toFixed(6)).join(',')).join('L')}Z` : '';
  let svgId = 0;
  function diagram(holes, className = '') {
    const id = `paper-mask-${++svgId}`;
    return `<svg class="${className}" viewBox="-2 -2 104 104" aria-hidden="true"><defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="white"/>${holes.map(p=>`<path d="${path(p)}" fill="black"/>`).join('')}</mask></defs><rect width="100" height="100" fill="#efd477" stroke="#d8bd65" stroke-width="1" mask="url(#${id})"/></svg>`;
  }
  const api = { EPS, square, identity, area, point, map, compose, inverse, reflection, clip, intersect, compile, candidate, path, diagram };
  root.ORIKIRI_GEOMETRY = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
