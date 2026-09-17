/* Rendering only: timing/state live in app.js, polygon math in geometry.js. */
(function () {
  const G = window.ORIKIRI_GEOMETRY;
  let serial = 0;
  class PaperRenderer {
    constructor(scene, model, animate) {
      this.scene = scene; this.model = model; this.animate = animate;
      this.cutCount = 0; this.prefix = `leaf-${++serial}`;
      this.container = document.createElement('div'); this.container.className = 'geometry-paper';
      this.container.innerHTML = model.leaves.map((leaf,i)=>`<div class="geo-leaf" data-leaf="${i}"></div>`).join('');
      scene.append(this.container);
      this.nodes = [...this.container.children];
      this.guide = document.createElementNS('http://www.w3.org/2000/svg','svg');
      this.guide.setAttribute('viewBox','0 0 100 100'); this.guide.classList.add('geometry-guide');
      this.guide.setAttribute('aria-hidden','true'); scene.append(this.guide);
      this.draw(); this.setStage(0);
    }
    pose(m, depth = 0) {
      const [a,b,c,d,e,f] = m, det = Math.round(a*d-b*c);
      return `translateZ(${depth}px) translate(${e}%,${f}%) matrix3d(${a},${b},0,0,${c},${d},0,0,0,0,${det},0,0,0,0,1)`;
    }
    depth(leaf, stage) {
      // Reverse the ordering of the moving packet at each fold.
      let z = 0;
      for (let i=0;i<stage;i++) if (leaf.moving[i]) z = (2 ** i) * .12 - z;
      return z;
    }
    draw(highlight = false) {
      this.model.leaves.forEach((leaf,i)=>{
        const id = `${this.prefix}-${i}`, cuts = leaf.cuts.filter(c=>c.index<this.cutCount);
        const content = `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="-1" y="-1" width="102" height="102"><path d="${G.path(leaf.polygon)}" fill="white"/>${cuts.map(c=>`<path d="${G.path(c.original)}" fill="black"/>`).join('')}</mask><clipPath id="${id}-clip"><path d="${G.path(leaf.polygon)}"/></clipPath></defs><path d="${G.path(leaf.polygon)}" class="geo-paper-fill" stroke="#cfb764" stroke-width=".22" mask="url(#${id})"/>${highlight ? cuts.map(c=>`<path d="${c.edges.map(edge=>`M${edge[0].join(",")}L${edge[1].join(",")}`).join('')}" fill="none" stroke="${c.index ? '#c77e44' : '#398873'}" stroke-width=".65" clip-path="url(#${id}-clip)"/>`).join('') : ''}`;
        // SVG defs must have unique IDs on front and back.
        this.nodes[i].innerHTML = `<svg class="geo-front" viewBox="0 0 100 100" aria-hidden="true">${content}</svg><svg class="geo-back" viewBox="0 0 100 100" aria-hidden="true">${content.replaceAll(id,`${id}-back`)}</svg>`;
      });
    }
    setStage(stage) {
      this.nodes.forEach((node,i)=>node.style.transform=this.pose(this.model.leaves[i].matrices[stage],this.depth(this.model.leaves[i],stage)));
      this.stage = stage;
      this.container.dataset.stage = stage;
    }
    async fold(index, open = false) {
      const fold = this.model.question.folds[index], [a,b] = fold.line;
      const axis = [b[0]-a[0],b[1]-a[1]], angle = fold.side*180;
      const tasks = [];
      this.model.leaves.forEach((leaf,i)=>{
        if (!leaf.moving[index]) return;
        const base = this.pose(leaf.matrices[index]);
        const frame = degrees => `translateZ(${this.depth(leaf,index)}px) translate(${a[0]}%,${a[1]}%) rotate3d(${axis[0]},${axis[1]},0,${degrees}deg) translate(${-a[0]}%,${-a[1]}%) ${base}`;
        tasks.push(this.animate(this.nodes[i],[{transform:frame(open ? angle : 0)},{transform:frame(open ? 0 : angle)}],1550));
      });
      const results = await Promise.all(tasks);
      if (results.every(Boolean)) this.setStage(open ? index : index+1);
    }
    showCut(index) {
      const cut = this.model.question.cuts[index];
      const packet = this.model.leaves.map(l=>G.map(l.matrices.at(-1),l.polygon));
      const id = `${this.prefix}-packet`;
      const edges = this.model.leaves.flatMap(leaf=>leaf.cuts.filter(c=>c.index===index).flatMap(c=>c.edges.map(edge=>G.map(leaf.matrices.at(-1),edge))));
      const edgePath = edges.map(edge=>`M${edge[0].join(',')}L${edge[1].join(',')}`).join('');
      const p = edges[0]?.[0] || cut.polygon[0];
      this.guide.innerHTML = `<defs><clipPath id="${id}">${packet.map(p=>`<path d="${G.path(p)}"/>`).join('')}</clipPath></defs><path d="${G.path(cut.polygon)}" clip-path="url(#${id})" fill="${index ? '#dba27144' : '#5c9e8444'}" /><path d="${edgePath}" fill="none" stroke="${index ? '#b36d36' : '#37594b'}" stroke-width=".85" stroke-dasharray="1.6 1.2"/><text x="${p[0]}" y="${p[1]-2}" font-size="9" fill="#294c3f">✂</text>`;
      this.guide.removeAttribute('hidden');
    }
    applyCut(index) { this.cutCount = index+1; this.draw(); }
    hideGuide() { this.guide.setAttribute('hidden',''); }
    highlight(on) { this.draw(on); }
    destroy() { this.container.remove(); this.guide.remove(); }
  }
  window.ORIKIRI_PaperRenderer = PaperRenderer;
})();
