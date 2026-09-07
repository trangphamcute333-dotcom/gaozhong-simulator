// 引擎回归验证:node verify.js [种子数]
// 1) 生成页引擎与 index.html 逐字节一致  2) simGame 与 UI 忠实回放差分  3) 结局可达性统计
'use strict';
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const src = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const engine = src.split('/*__ENGINE_START__*/')[1].split('/*__ENGINE_END__*/')[0].trim();
if(!engine || engine.length < 1000){
  console.error('❌ 未找到引擎块(__ENGINE_START__/__ENGINE_END__)');
  process.exit(1);
}
const N = parseInt(process.argv[2], 10) || 1000;
let fails = 0;
function ok(m){ console.log('✅ ' + m); }
function bad(m){ fails++; console.log('❌ ' + m); }

// 1) 生成页引擎一致性
let engineOk = true;
[['种子筛选器.html', '// ============ 筛选器 UI'], ['事件图鉴.html', '// ============ 事件图鉴 UI']].forEach(function(t){
  const s = fs.readFileSync(path.join(dir, t[0]), 'utf8');
  const start = s.indexOf('<script>') + 8;
  const end = s.indexOf(t[1]);
  if(end < 0){ bad(t[0] + ' 未找到 UI 锚点'); engineOk = false; return; }
  if(s.slice(start, end).trim() === engine) ok(t[0] + ' 引擎与 index.html 一致');
  else { bad(t[0] + ' 引擎不一致,请运行 node build-filter.js 重建'); engineOk = false; }
});

// 2+3 需要引擎内执行:拼在同一个 eval 字符串里(strict 模式作用域)
const testCode = String.raw`
var __out = [];
function pickFirst(g, ev, opts){ return opts[0]; }
function pickLast(g, ev, opts){ return opts[opts.length-1]; }
// UI 忠实回放:玩家只能点「第一个可点击」的选项(与真实游戏一致)
function uiPlay(seed, diff, origin, mode){
  var g = createGame(seed, diff, origin);
  var fe;
  while(g.sem < 6){
    semesterStart(g);
    fe = forcedEnding(g); if(fe) return {ending:fe, score:null};
    var evs = drawEvents(g);
    if(evs.length === 0) return {ending:null, score:null};
    for(var i=0;i<evs.length;i++){
      var opts = eligibleOpts(g, evs[i]);
      if(opts.length === 0) return {ending:null, score:null};
      applyOption(g, evs[i], mode === 'first' ? opts[0] : opts[opts.length-1]);
      fe = forcedEnding(g); if(fe) return {ending:fe, score:null};
    }
    runExam(g);
    fe = forcedEnding(g); if(fe) return {ending:fe, score:null};
  }
  var last = g.scores[g.scores.length-1];
  return {ending:determineEnding(g, last.score).id, score:last.score};
}
// 2) 差分检查
var mism = 0, played = 0;
for(var i=0;i<__N;i++){
  var seed = i+1;
  var o = ORIGINS[i % ORIGINS.length].id;
  var d = ['hard','normal','fast'][i % 3];
  ['first','last'].forEach(function(mode){
    var g = createGame(seed, d, o);
    var sim = simGame(g, mode === 'first' ? pickFirst : pickLast);
    var ui = uiPlay(seed, d, o, mode);
    played++;
    if(sim.ending !== ui.ending || sim.score !== ui.score){
      mism++;
      if(mism <= 3) __out.push('差分不一致:种子 '+seed+' '+o+' '+d+' '+mode+' sim='+sim.ending+'/'+sim.score+' ui='+ui.ending+'/'+ui.score);
    }
  });
}
__out.push('差分检查('+__N+' 种子 × 2 策略): 共 '+played+' 局,不匹配 '+mism+' 局');
// 3) 结局可达性
var per = {};
for(var s2=0;s2<PICK_STRATEGIES.length;s2++) per[PICK_STRATEGIES[s2].id] = 0;
var perEnding = {};
ENDINGS.forEach(function(e){ perEnding[e.id] = 0; });
for(var j=0;j<__N;j++){
  var seed2 = j+1;
  var o2 = ORIGINS[j % ORIGINS.length].id;
  var d2 = ['hard','normal','fast'][j % 3];
  for(var s3=0;s3<PICK_STRATEGIES.length;s3++){
    var g2 = createGame(seed2, d2, o2);
    var r2 = simGame(g2, PICK_STRATEGIES[s3].fn);
    if(r2.ending && perEnding[r2.ending] !== undefined) perEnding[r2.ending]++;
  }
}
var unreachable = [];
ENDINGS.forEach(function(e){
  if(perEnding[e.id] === 0) unreachable.push(e.id + '(' + e.name + ')');
});
__out.push('结局可达性('+__N+' 种子 × '+PICK_STRATEGIES.length+' 策略):');
__out.push('  0 命中(可能不可达): ' + (unreachable.length ? unreachable.join('、') : '无'));
globalThis.__out = __out;
globalThis.__mism = mism;
`;
eval(engine + '\n' + testCode.split('__N').join(String(N)));

__out.forEach(function(l){ console.log(l); });
if(!engineOk) bad('引擎不一致(见上)');
if(__mism > 0) bad('差分检查不通过:' + __mism + ' 局不匹配');
if(fails === 0) console.log('🎉 全部通过');
process.exit(fails === 0 ? 0 : 1);
