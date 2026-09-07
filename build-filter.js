// 生成独立的「种子筛选器」页面:从 index.html 提取引擎层(事件/结局/模拟逻辑)
// 修改 index.html 的事件或数值后,运行:node build-filter.js
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const src = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const engine = src.split('/*__ENGINE_START__*/')[1].split('/*__ENGINE_END__*/')[0];
if(!engine || engine.length < 1000){
  console.error('❌ 未找到引擎层标记(__ENGINE_START__/__ENGINE_END__),index.html 是否被修改过?');
  process.exit(1);
}
const tpl = fs.readFileSync(path.join(dir, 'filter.template.html'), 'utf8');
const out = tpl
  .replace('/*__ENGINE__*/', engine.trim())
  .replace('/*__BUILD_TIME__*/', new Date().toLocaleString('zh-CN', {hour12:false}));
fs.writeFileSync(path.join(dir, '种子筛选器.html'), out);
console.log('✅ 已生成 种子筛选器.html(引擎代码 ' + engine.length + ' 字符)');
