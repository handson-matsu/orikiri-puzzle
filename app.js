'use strict';
const G = window.ORIKIRI_GEOMETRY;
const questions = window.ORIKIRI_QUESTIONS;
const $ = selector => document.querySelector(selector);
const right = $('#right-half');
const bottoms = [...document.querySelectorAll('.bottom')];
const targets = { right: [right], bottom: bottoms };
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let questionIndex = 0, question = questions[0], model, renderer;
let state = 'ready', run = 0;
const animations = new Set();
const completed = new Set();
const pause = ms => new Promise(resolve => setTimeout(resolve, motion.matches ? Math.min(ms, 160) : ms));
function step(index) {
  document.querySelectorAll('.steps li').forEach((el, i) => {
    el.classList.toggle('active', i === index);
    if (i === index) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
  });
}
function say(text, note) { $('#instruction').textContent = text; if (note) $('#stage-note').textContent = note; }
async function animate(el, frames, duration) {
  const animation = el.animate(frames, { duration: motion.matches ? 100 : duration, easing:'cubic-bezier(.45,0,.2,1)',fill:'forwards' });
  animations.add(animation);
  try { await animation.finished; el.style.transform = frames.at(-1).transform; return true; }
  catch { return false; }
  finally { animation.cancel(); animations.delete(animation); }
}
// Question 1 keeps its original hierarchical 4-face DOM and exact transforms.
function transform(target, angle, mirrored = false) {
  return `translateZ(${angle ? (target === 'right' ? 2 : mirrored ? -3 : 3) : 0}px) rotate${target === 'right' ? 'Y' : 'X'}(${mirrored ? -angle : angle}deg)`;
}
async function fold(index, open = false) {
  if (!question.legacy) return renderer.fold(index,open);
  const data = question.folds[index];
  await Promise.all(targets[data.target].map(el => {
    const end = transform(data.target, open ? 0 : data.angle, el.classList.contains('d'));
    return animate(el,[{transform:el.style.transform || transform(data.target,0)},{transform:end}],1550);
  }));
}
function renderChoices() {
  $('#choices').innerHTML = question.choices.map((choice,index) => {
    let svg;
    if (question.legacy) svg = `<svg viewBox="-2 -2 104 104" aria-hidden="true"><path d="${choice.outline || 'M0 0H100V100H0Z'} ${choice.hole || ''}" fill="#efd477" stroke="#d8bd65" stroke-width="1" fill-rule="evenodd"/></svg>`;
    else svg = G.diagram(choice.id === question.answer ? model.holes : G.candidate(model,choice));
    return `<button class="choice" data-id="${choice.id}" disabled aria-label="${String.fromCharCode(65+index)}：${choice.label}" aria-pressed="false"><span class="letter">${String.fromCharCode(65+index)}</span>${svg}</button>`;
  }).join('');
  document.querySelectorAll('.choice').forEach(button=>button.addEventListener('click',()=>select(button)));
}
function reset() {
  run++; animations.forEach(a=>a.cancel()); animations.clear();
  state = 'ready';
  if (renderer) { renderer.destroy(); renderer = null; }
  [right,...bottoms].forEach(el=>el.style.transform='');
  document.querySelectorAll('.face').forEach(el=>el.style.clipPath='');
  $('.cut-guide').classList.remove('visible'); $('.scrap').classList.remove('falling');
  $('#paper').hidden = !question.legacy;
  $('.cut-guide').toggleAttribute('hidden',!question.legacy); $('.scrap').hidden = !question.legacy;
  model = G.compile(question);
  if (!question.legacy) renderer = new window.ORIKIRI_PaperRenderer($('.paper-scene'),model,animate);
  $('#play').disabled = false; $('#replay').disabled = true;
  $('#reveal').hidden = true; $('#reveal').disabled = false; $('#lesson').hidden = true;
  $('#lesson p').textContent = question.lesson;
  $('#feedback').className='feedback'; $('#feedback').textContent='まずは「再生」を押してみよう。';
  $('#quiz-description').textContent='紙を切ったら、答えをひとつ選んでね。';
  say('準備はいい？ 紙の動きをよく見てね。','一枚の紙から、はじめよう。');
  step(0); renderChoices();
}
async function cutLegacy(token) {
  step(1); say(question.cut.label,'③ この角を、ちょきん。');
  $('.cut-guide').classList.add('visible'); await pause(1700); if (token!==run) return;
  Object.entries(question.cut.polygons).forEach(([tile,polygon])=>document.querySelectorAll(`.${tile} .face`).forEach(face=>{
    face.style.clipPath = `polygon(${face.classList.contains('back') ? polygon.split(',').map(point=>{ const [x,y]=point.split(' '); return `${100-parseFloat(x)}% ${y}`; }).join(',') : polygon})`;
  }));
  $('.scrap').classList.add('falling'); await pause(850); if (token!==run) return;
  $('.cut-guide').classList.remove('visible');
}
async function play() {
  reset(); const token=run; state='folding'; $('#play').disabled=true;
  $('#feedback').textContent='折り方と、切る場所をよく見てね。';
  for (let i=0;i<question.folds.length;i++) {
    const data=question.folds[i]; say(data.label,data.note); await fold(i); if(token!==run)return;
    await pause(450); if(token!==run)return;
  }
  if(question.legacy) await cutLegacy(token);
  else {
    step(1);
    for(let i=0;i<question.cuts.length;i++) {
      say(`${question.cuts[i].label}を切るよ。`,`${i+1} / ${question.cuts.length} か所目を、ちょきん。`);
      renderer.showCut(i); await pause(1700); if(token!==run)return;
      renderer.applyCut(i); await pause(850); if(token!==run)return; renderer.hideGuide();
    }
  }
  if(token!==run)return;
  state='quiz'; step(2); say('切った紙を全部開くと、どうなるかな？','頭の中で、ひらいてみよう。');
  $('#quiz-description').textContent='できあがる形を、ひとつ選んでね。';
  $('#feedback').textContent='A〜Dから、予想した形を選ぼう。';
  document.querySelectorAll('.choice').forEach(el=>el.disabled=false); $('#replay').disabled=false;
}
function select(button) {
  if(state!=='quiz')return;
  state='answered'; const correct=button.dataset.id===question.answer;
  button.classList.add('selected',correct?'correct':'wrong'); button.setAttribute('aria-pressed','true');
  document.querySelectorAll('.choice').forEach(el=>el.disabled=true);
  $('#feedback').textContent=correct?'正解！ ひらいて確かめてみよう。':'不正解。でも大丈夫！ ひらいて見てみよう。';
  $('#feedback').classList.toggle('success',correct); $('#reveal').hidden=false;
}
async function reveal() {
  if(state!=='answered')return;
  const token=run; state='opening'; step(3); $('#reveal').disabled=true; $('#replay').disabled=true;
  if(renderer) {
    renderer.highlight(true);
    if(innerWidth<=760) $('#stage').scrollIntoView({block:'center',behavior:'instant'});
  }
  for(let index=question.folds.length-1;index>=0;index--) {
    const data=question.folds[index];
    if(question.legacy) say(index===1?'下へひらくと、切り口も上下にうつる。':'右へひらくと、切り口が左右にうつる。',index===1?'④ よこの折り目をひらく':'⑤ たての折り目をひらく');
    else say(data.open,`折り目をひらく：${question.folds.length-index} / ${question.folds.length}`);
    await fold(index,true); if(token!==run)return;
    await pause(800); if(token!==run)return;
  }
  state='done'; if(renderer)renderer.highlight(false);
  say(question.legacy?'真ん中に、ひし形ができた！':question.answerLabel,'折り目をはさんで、同じ形。');
  $('#lesson').hidden=false; $('#reveal').hidden=true; $('#replay').disabled=false;
  document.querySelector(`[data-id="${question.answer}"]`).classList.add('correct');
  const answerIndex=question.choices.findIndex(c=>c.id===question.answer);
  $('#feedback').textContent=`答えは ${String.fromCharCode(65+answerIndex)}：${question.choices[answerIndex].label}！`;
  $('#feedback').classList.add('success'); completed.add(questionIndex); renderList();
}
function renderList() {
  $('#question-grid').innerHTML=questions.map((q,i)=>`<button data-question="${i}" aria-label="問題${i+1}：${q.title}、難易度${q.difficulty}${completed.has(i)?'、確認ずみ':''}" ${i===questionIndex?'aria-current="true"':''}><strong>${i+1}</strong><small>${'★'.repeat(q.difficulty)}</small>${completed.has(i)?'<span class="completed">✓</span>':''}</button>`).join('');
  document.querySelectorAll('[data-question]').forEach(button=>button.addEventListener('click',()=>{
    $('#question-list').close(); changeQuestion(Number(button.dataset.question)); $('#show-questions').focus();
  }));
}
function changeQuestion(index) {
  if(index<0||index>=questions.length)return;
  questionIndex=index; question=questions[index]; reset();
  $('.workspace').classList.toggle('extended',!question.legacy);
  $('#question-count').textContent=`問題 ${index+1} / ${questions.length}`;
  $('.question-tag').textContent=`QUESTION ${String(index+1).padStart(2,'0')}`;
  if(question.legacy) $('.difficulty').innerHTML='<i></i> はじめの一歩';
  else $('.difficulty').textContent=`${'★'.repeat(question.difficulty)} ${question.title}`;
  $('.edition b').textContent=String(index+1).padStart(2,'0');
  $('#previous').disabled=index===0; $('#next').disabled=index===questions.length-1;
  renderList();
}
$('#play').addEventListener('click',play);
$('#replay').addEventListener('click',play);
$('#reset').addEventListener('click',reset);
$('#reveal').addEventListener('click',reveal);
$('#previous').addEventListener('click',()=>changeQuestion(questionIndex-1));
$('#next').addEventListener('click',()=>changeQuestion(questionIndex+1));
$('#show-questions').addEventListener('click',()=>{renderList();$('#question-list').showModal();});
$('#close-questions').addEventListener('click',()=>$('#question-list').close());
changeQuestion(0);
