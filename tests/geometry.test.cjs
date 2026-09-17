const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const G = require('../geometry.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../questions.js'),'utf8'),context);
const questions = context.window.ORIKIRI_QUESTIONS;
function inside(p, polygon) {
  let result = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if (((a[1]>p[1]) !== (b[1]>p[1])) && p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) result=!result;
  }
  return result;
}
// Independent point oracle: projection onto each fold line, no affine matrices,
// leaf splitting, clipping or inverse-unfold code from the implementation.
function foldPoint(p, folds) {
  p=[...p];
  for(const f of folds) {
    const [a,b]=f.line, x=b[0]-a[0],y=b[1]-a[1];
    if ((x*(p[1]-a[1])-y*(p[0]-a[0]))*f.side > 0) {
      const t=((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y);
      p=[2*(a[0]+t*x)-p[0],2*(a[1]+t*y)-p[1]];
    }
  }
  return p;
}
function touch(a,b) {
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++) {
    const p=a[i],q=a[(i+1)%a.length],r=b[j],s=b[(j+1)%b.length];
    if(Math.max(p[0],q[0])+1e-7<Math.min(r[0],s[0]) || Math.max(r[0],s[0])+1e-7<Math.min(p[0],q[0]) || Math.max(p[1],q[1])+1e-7<Math.min(r[1],s[1]) || Math.max(r[1],s[1])+1e-7<Math.min(p[1],q[1])) continue;
    if(cross(p,q,r)*cross(p,q,s)<=1e-7 && cross(r,s,p)*cross(r,s,q)<=1e-7)return true;
  }
  return inside(a[0],b)||inside(b[0],a);
}
function polygonComponents(polygons) {
  const parents=polygons.map((_,i)=>i);
  const find=i=>parents[i]===i?i:(parents[i]=find(parents[i]));
  for(let i=0;i<polygons.length;i++)for(let j=0;j<i;j++)if(touch(polygons[i],polygons[j]))parents[find(i)]=find(j);
  return new Set(parents.map((_,i)=>find(i))).size;
}
const size=320;
function raster(holes) {
  const out=new Uint8Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)
    out[y*size+x]=holes.some(poly=>inside([(x+.371)*100/size,(y+.613)*100/size],poly))?1:0;
  return out;
}
function components(pixels) {
  const seen=new Uint8Array(pixels.length);let n=0;
  for(let i=0;i<pixels.length;i++)if(pixels[i]&&!seen[i]) {
    n++;const stack=[i];seen[i]=1;
    while(stack.length) {
      const j=stack.pop(),x=j%size,y=Math.floor(j/size);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const a=x+dx,b=y+dy,k=b*size+a;
        if(a>=0&&a<size&&b>=0&&b<size&&pixels[k]&&!seen[k]){seen[k]=1;stack.push(k);}
      }
    }
  }
  return n;
}
assert.equal(questions.length,10);
for(const [index,q] of questions.entries()) {
  const m=G.compile(q);
  assert.ok(Math.abs(m.leaves.reduce((s,l)=>s+G.area(l.polygon),0)-10000)<1e-6, 'Paper area conserved');
  assert.equal(q.choices.filter(c=>c.id===q.answer).length,1);
  const actual=raster(m.holes);
  let differences=0;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const p=[(x+.371)*100/size,(y+.613)*100/size];
    const folded=foldPoint(p,q.folds);
    const expected=q.cuts.some(c=>inside(folded,c.polygon));
    if(Boolean(actual[y*size+x])!==expected) differences++;
  }
  assert.equal(differences,0,`Q${index+1}: independent forward-fold oracle vs rendered/answer holes`);
  assert.equal(components(actual),q.expectedCuts,`Q${index+1}: connected cutouts`);
  for(const leaf of m.leaves) for(const cut of leaf.cuts) {
    assert.ok(Math.abs(G.area(cut.original)-G.area(cut.folded))<1e-7);
    const restored=G.map(leaf.matrices.at(-1),cut.original);
    restored.forEach((p,i)=>assert.ok(Math.hypot(p[0]-cut.folded[i][0],p[1]-cut.folded[i][1])<1e-7));
  }
  const stageCounts = [[1,1,1],[2,1],[4,2,1],[2,2,1],[8,4,2],[1,1,1],[2,1],[4,2,1],[8,4,2,1],[5,3,2,2]][index];
  for(let stage=0;stage<=q.folds.length;stage++) {
    const holes=m.leaves.flatMap(leaf=>leaf.cuts.map(cut=>G.map(leaf.matrices[stage],cut.original)));
    assert.equal(polygonComponents(holes),stageCounts[stage],`Q${index+1}: exact polygon connectivity at stage ${stage}`);
    assert.equal(components(raster(holes)),stageCounts[stage],`Q${index+1}: cutout connectivity at stage ${stage}`);
  }
  for(let cutIndex=0;cutIndex<q.cuts.length;cutIndex++)
    assert.ok(m.leaves.some(l=>l.cuts.some(c=>c.index===cutIndex&&c.edges.length)), 'Each cut has visible cutting edges');
  if(index===9) assert.equal(components(raster(G.candidate(m,q.choices[0]))),16,'Q10 misconception really has 16 independent holes');
  if(!q.legacy) {
    const images=q.choices.map(c=>c.id===q.answer?actual:raster(G.candidate(m,c)));
    for(let a=0;a<4;a++)for(let b=a+1;b<4;b++) {
      let diff=0;for(let i=0;i<actual.length;i++)if(images[a][i]!==images[b][i])diff++;
      assert.ok(diff>60,`Q${index+1} choices ${a}/${b} must visibly differ (${diff} pixels)`);
    }
  } else {
    // Existing question 1's SVG hole is exactly the union of its four corner cuts.
    const diamond=raster([[[50,39],[61,50],[50,61],[39,50]]]);
    assert.deepEqual(actual,diamond);
  }
  console.log(`Q${index+1}: ${m.leaves.length} leaves, ${q.cuts.length} cuts, ${q.expectedCuts} connected cutouts — PASS`);
}
console.log('All 10 questions match the independent forward-fold oracle at 102,400 samples each.');
