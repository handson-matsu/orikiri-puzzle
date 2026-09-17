/* 問題1の既存データは保持。末尾に汎用の折り線・切断・誤答データを追加します。 */
window.ORIKIRI_QUESTIONS = [{
  id: 'center-diamond',
  folds: [
    { target: 'right', angle: -180, label: '右半分を、左へぱたん。', note: '① たての線で折る' },
    { target: 'bottom', angle: 180, label: '下半分を、上へぱたん。', note: '② よこの線で折る' }
  ],
  cut: {
    label: '折り目が集まる角を、三角に切るよ。',
    polygons: { a: '0 0,100% 0,100% 78%,78% 100%,0 100%', b: '0 0,78% 0,100% 22%,100% 100%,0 100%', c: '0 0,100% 0,100% 100%,22% 100%,0 78%', d: '22% 0,100% 0,100% 100%,0 100%,0 22%' }
  },
  answer: 'diamond',
  choices: [
    { id: 'square', label: '真ん中に四角い穴', hole: 'M39 39H61V61H39Z' },
    { id: 'corners', label: '四すみが切れた形', outline: 'M16 0H84L100 16V84L84 100H16L0 84V16Z' },
    { id: 'diamond', label: '真ん中にひし形の穴', hole: 'M50 39L61 50L50 61L39 50Z' },
    { id: 'triangles', label: '上下に三角の切りこみ', outline: 'M0 0H39L50 14L61 0H100V100H61L50 86L39 100H0Z' }
  ]
}];

// line is expressed in the CURRENT folded paper's coordinate system (0..100).
// side is the sign of cross(lineStart, lineEnd, point) on the moving side.
(() => {
  const vertical = { line: [[50,0],[50,100]], side: -1, label: '右半分を、左へぱたん。', note: 'たての線で折る', open: '右へひらくと、切り口も左右にうつる。' };
  const horizontal = { line: [[0,50],[100,50]], side: 1, label: '下半分を、上へぱたん。', note: 'よこの線で折る', open: '下へひらくと、切り口も上下にうつる。' };
  const diagonal = { line: [[0,0],[100,100]], side: -1, label: '斜めの線で、右上を左下へぱたん。', note: '斜めの線で折る', open: '斜めの折り目をはさんで、切り口がうつる。' };
  const smallDiagonal = { ...diagonal, line: [[0,0],[50,50]] };
  const cut = (polygon, label) => ({ polygon, label });
  const first = window.ORIKIRI_QUESTIONS[0];
  // Keep the original question's presentation, choices and renderer unchanged.
  Object.assign(first, { title: 'はじめの一歩', difficulty: 1, legacy: true, expectedCuts: 1, cuts: [cut([[39,50],[50,39],[50,50]], '折り目が集まる角')], lesson: '折り返したところには、同じ形が線対称に現れます。' });
  first.folds = first.folds.map((f,i)=>({ ...[vertical,horizontal][i], ...f }));
  const definitions = [
    { id:'one-fold', title:'ひとつの折り目', difficulty:1, folds:[vertical],
      cuts:[cut([[0,27],[10,32],[0,41]], '左の辺の途中')], expectedCuts:2,
      lesson:'1回ひらくと、左の切り口が右にも現れます。高さは同じで、向きは反対です。',
      options:[{kind:'correct'}, {skip:[0],label:'片側だけに切り口',reason:'1回分の折り返しを忘れている'}, {axes:{0:horizontal},label:'上下に切り口',reason:'対称の方向を上下と考えている'}, {cuts:[cut([[0,59],[10,68],[0,73]])],label:'下寄りに左右の切り口',reason:'折り目と平行な方向にも位置を反転している'}], answerLabel:'左右の同じ高さに、2つの切り口' },
    { id:'four-cuts', title:'切り口はどこへ？', difficulty:1, folds:[vertical,horizontal],
      cuts:[cut([[0,16],[11,20],[0,29]], '折り目から離れた左の辺')], expectedCuts:4,
      lesson:'折り目から離れた切り口は、上下、そして左右にうつり、4か所に現れます。',
      options:[{skip:[1],label:'左右の2か所',reason:'よこの折り目を開き忘れている'}, {cuts:[cut([[16,0],[20,11],[29,0]])],label:'上下の辺に4か所',reason:'たてとよこの対称移動を取り違えている'}, {translate:[1],label:'上下の切り口が同じ向き',reason:'反転せずに平行移動している'}, {kind:'correct'}], answerLabel:'左右の辺に、向きが対称な4つの切り口' },
    { id:'on-crease', title:'折り目の上を切ると', difficulty:2, folds:[vertical,horizontal],
      cuts:[cut([[50,14],[41,20],[50,26]], 'たての折り目の途中')], expectedCuts:2,
      lesson:'折り目で接する2つの三角が、ひとつのひし形につながります。完成する穴は4個ではなく2個です。',
      options:[{cuts:[cut([[44,14],[35,20],[44,26]])],label:'離れた4つの三角の穴',reason:'折り目で切り口がつながることを忘れている'}, {kind:'correct'}, {skip:[1],label:'ひし形の穴が1つ',reason:'上下への折り返しを忘れている'}, {cuts:[cut([[14,50],[20,41],[26,50]])],label:'左右に2つのひし形',reason:'どちらの折り目を切ったかを取り違えている'}], answerLabel:'上下に2つのひし形の穴' },
    { id:'two-cuts', title:'ふたつを追いかけて', difficulty:2, folds:[vertical,horizontal],
      cuts:[cut([[15,0],[28,0],[19,10]], '上の辺'),cut([[0,30],[9,34],[0,41]], '左の辺')], expectedCuts:8,
      lesson:'2か所の切り口を別々に追うと、それぞれ4か所。上・下・左・右に8つの切り口ができます。',
      options:[{skip:[1],label:'半分だけの4つの切り口',reason:'2回目の折り返しを忘れている'}, {translate:[0,1],label:'同じ向きの8つの切り口',reason:'切り口の向きを反転していない'}, {kind:'correct'}, {cuts:[cut([[30,0],[41,0],[34,9]]),cut([[0,15],[10,19],[0,28]])],label:'位置を入れ替えた8つの切り口',reason:'2か所の切る位置を入れ替えている'}], answerLabel:'2種類の切り口が、4か所ずつ' },
    { id:'crease-intersection', title:'折り目が出会うところ', difficulty:2, folds:[vertical,horizontal],
      cuts:[cut([[40,35],[53,35],[53,53],[40,53]], '2つの折り目が出会う角を四角く')], expectedCuts:1,
      lesson:'2つの折り目にまたがる切り口は、開くたびにつながります。4つの部分が合わさって、縦長の穴ひとつになります。',
      options:[{kind:'correct'}, {cuts:[cut([[35,40],[53,40],[53,53],[35,53]])],label:'中央に横長の穴',reason:'切り口の縦と横の長さを取り違えている'}, {cuts:[cut([[35,30],[45,30],[45,45],[35,45]])],label:'離れた4つの四角い穴',reason:'2回折ると必ず4個になると考えている'}, {skip:[1],label:'中心より上に四角い穴',reason:'よこの折り目でつながる部分を忘れている'}], answerLabel:'中央に縦長の四角い穴が1つ' },
    { id:'diagonal', title:'斜めにも、うつる', difficulty:3, folds:[diagonal],
      cuts:[cut([[23,100],[28,87],[39,100]], '三角の紙の下の辺')], expectedCuts:2,
      lesson:'斜めの折り目では、下の辺の切り口が右の辺にうつります。切り口の向きも斜めの線について反転します。',
      options:[{axes:{0:horizontal},label:'上下に2つの切り口',reason:'斜め折りを上下の折りと考えている'}, {axes:{0:{line:[[0,100],[100,0]]}},label:'下と左に切り口',reason:'もう一方の対角線について反転している'}, {kind:'correct'}, {cuts:[cut([[61,100],[72,87],[77,100]])],label:'下と右の反対寄りに切り口',reason:'斜めの反射で位置を逆側へ移している'}], answerLabel:'下の辺と右の辺に、対角線で対称な切り口' },
    { id:'straight-diagonal', title:'たて、それから斜め', difficulty:3, folds:[vertical,smallDiagonal],
      cuts:[cut([[0,28],[9,32],[0,40]], '斜めに重なった部分の左の辺')], expectedCuts:4,
      lesson:'先に斜めをひらくと左と上に現れ、次にたてをひらくと右と上にも現れます。開く順番を逆にたどろう。',
      options:[{skip:[1],label:'左右だけに切り口',reason:'斜めの折り返しを忘れている'}, {kind:'correct'}, {axes:{1:horizontal},label:'左右の辺に4つの切り口',reason:'斜めの折り返しを上下の反射と考えている'}, {cuts:[cut([[0,10],[9,14],[0,22]])],label:'左右と上の端寄りに4つ',reason:'斜め折りでうつる位置を取り違えている'}], answerLabel:'左と右に1つずつ、上に2つの切り口' },
    { id:'three-folds', title:'3回の折り返し', difficulty:3, folds:[vertical,horizontal,smallDiagonal],
      cuts:[cut([[0,23],[7,27],[0,33]], '折り目ではない左の辺')], expectedCuts:8,
      lesson:'折り目から離れた切り口が、斜め・上下・左右の順にうつります。最後は4つの辺に2つずつ、8か所です。',
      options:[{skip:[2],label:'左右の辺に4つ',reason:'斜めの折り返しを忘れている'}, {cuts:[cut([[0,9],[7,13],[0,19]])],label:'四すみ寄りの8つ',reason:'3回目の折り目からの距離を取り違えている'}, {translate:[0,1],label:'向きの違う8つ',reason:'位置だけをうつして切り口の向きを反転していない'}, {kind:'correct'}], answerLabel:'4つの辺に2つずつ、8つの切り口' },
    { id:'final-challenge', title:'つながる形を見つけよう', difficulty:4, folds:[vertical,horizontal,smallDiagonal],
      cuts:[cut([[18,18],[27,27],[16,29]], '斜めの折り目の途中'),cut([[43,43],[53,43],[53,53],[43,53]], '折り目が集まる角')], expectedCuts:5,
      lesson:'斜めの折り目上の切り口は、2つずつつながって4つの穴に。交点の切り口は全部つながって中央の穴に。合計5つです。',
      options:[{cuts:[cut([[10,21],[19,30],[8,32]]),cut([[37,44],[40,44],[40,48],[37,48]])],label:'切り口がすべて離れた16個の穴',reason:'3回折り×2か所なら必ず16個と考えている'}, {skip:[2],label:'斜めの反射がない穴',reason:'斜めの折り目で穴がつながることを忘れている'}, {kind:'correct'}, {cuts:[cut([[10,10],[19,19],[8,21]]),cut([[43,43],[53,43],[53,53],[43,53]])],label:'中央と四すみ寄りの5つの穴',reason:'個数は合っているが折り目上の位置を取り違えている'}], answerLabel:'中央に1つ、その周りに4つ。合計5つの穴' }
  ];
  for (const q of definitions) {
    q.answer = 'answer';
    q.choices = q.options.map((option,i) => ({ ...option, id: option.kind === 'correct' ? 'answer' : `mistake-${i}`, label: option.kind === 'correct' ? q.answerLabel : option.label }));
    delete q.options;
    window.ORIKIRI_QUESTIONS.push(q);
  }
})();
