# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

纯前端「高中生涯模拟器」文字游戏,无构建系统、无依赖、无测试框架,用户以中文交流(提交信息也用中文)。

## 文件结构与核心约定

- `index.html` — 游戏本体(HTML/CSS/JS 单文件)。JS 分两层,用注释标记分隔:
  - `/*__ENGINE_START__*/` 到 `/*__ENGINE_END__*/` 之间是**引擎层**:事件/结局/出身/难度数据 + 纯函数模拟逻辑(`createGame`/`simGame`/`PICK_STRATEGIES` 等),**不依赖 DOM**,可在 node 中直接 eval 复用。
  - 标记之后是 UI 层(DOM/事件/渲染)。
- `种子筛选器.html` — 独立「种子筛选器」页面,**生成产物,禁止手改**。由 `build-filter.js` 从 `filter.template.html` + index.html 引擎层拼装。
- `事件图鉴.html` — 独立「事件图鉴」页面(全部事件/选项数值/概率一览),同样是**生成产物**,来自 `events.template.html`。
- `build-filter.js` — 构建脚本,一次生成上述两个页面。**改完 index.html 引擎层(事件/数值/结局)后必须运行 `node build-filter.js` 重建**,否则页面引擎不一致,筛选出的种子在游戏里无法复现。

## 确定性契约(最重要)

同种子 + 同出身 + 同难度 + 同样思路 = 完全相同的结局与分数。RNG 用 `mulberry32(seed)` 保证可复现;游戏页与筛选器页的引擎代码必须**逐字节一致**(改动后除重建外,还应 diff 验证)。

- 复现码格式:`种子@出身@难度`(如 `12@rich@fast`)。游戏主页的种子输入框会解析整串并自动按此出身/难度开局;筛选器结果的「复制复现码」按钮生成它。出身 id 见 `ORIGINS`,难度 id 见 `DIFF`。
- 彩蛋(在游戏主页种子输入框**输入即触发**,无需点按钮):`20070401` → 跳转 种子筛选器.html;`20070108` → 跳转 事件图鉴.html。实现在 index.html UI 层的 `trySeedEgg`。
- 筛选器默认出身/难度随种子轮换:`ORIGINS[i % ORIGINS.length]` 与 `['hard','normal','fast'][i % 3]`(i 从 0 起,种子 = i+1)。

## 全成就与主题(UI 层特性)

- 存档用 localStorage(`store` 封装),键:`hs_sim.endings`(已解锁结局)、`hs_sim.records`(生涯档案)、`hs_sim.theme`(配色,green/gold)、`hs_sim.all_celebrated`(庆祝是否已弹过)。
- 全成就庆祝:在 `saveEndingRecord` 里检测最后一个结局解锁后 0.9s 弹 `showCelebration`;启动时对「更新前就已全成就」的玩家补触发一次。庆祝弹层 + 彩带动画在 `#celebrate-overlay`。
- 配色主题用**覆盖式 CSS**:不引入 CSS 变量,保留默认绿色规则,追加 `body.theme-gold` 开头的覆盖规则(金色 #b7791f/#fffbeb/#f6e05e)。新增主题或调色时,同步改三处:CSS 覆盖块、`drawCard` 里 canvas 的条件色(用 `isGoldTheme()`)、`doEnding` 的内联颜色。主页「🎨 配色」按钮仅全成就后显示。

## 结局页/分享/多周目(UI 层)

- 结局页:三年数值曲线 `renderTrend`(数据源 `G.history`,引擎在 `createGame`/`runExam` 记录快照,**不消耗 RNG**,不影响确定性)+ 人生时间线 `renderTimeline`(数据源 `G.log`)。曲线图例渲染在 `#trend-legend` 的 HTML 里,**不要画进 canvas**(曾与 x 轴学期标签重叠)。
- URL 分享:`?seed=12@rich@fast` 启动时解析(带出身/难度直接开局,纯数字填入输入框,彩蛋号同样生效);结局页「分享链接」按钮复制该链接,实现在启动 IIFE 与 `btn-share` 处理器。启动执行顺序:initHome → 主题应用 → 补庆祝 → URL 解析(可能直接 `startGame` 覆盖主页)。
- 传承加成(New Game+):全成就后出身选择页出现勾选框(天赋+3/金钱+10/健康+5,默认关),`G.ngp` 标记并写入档案;**勾选会改变种子结果**,复现筛选器种子时勿勾选。
- 筛选器结果有「▶ 回放」按钮:按该种子当时的策略复现整局,逐步展示选择/数值变化/考试/结局(实现在 filter.template.html 的 `replayCollect`/`startReplay`,改回放逻辑后要重建生成页)。

## 数值平衡的改法

- `ENDINGS` 按数组顺序取第一个满足者(优先级),改阈值会改变结局分布。
- 用户以「达成率」提需求(例:学生领袖要求贪心·知名度策略下 ~1% 达成)。改前先用 node eval 引擎块跑 `simGame` 扫 N 个种子 × 各策略统计达成率,改后复测报告——不要拍脑袋定数值。
- 结局图鉴只对**未解锁**结局显示条件提示(已解锁显示结局描述,看不到数字,用户常因此误以为没改)。

## 验证手法(无测试套件)

- `node build-filter.js` 重建筛选器页。
- **`node verify.js [种子数]`** 回归验证:生成页引擎一致性 + simGame 差分(2000 局应为 0 不匹配)+ 各结局可达性统计。改引擎后必跑。
- 提取页面 `<script>` 内容后 `node --check` 做语法校验。
- node 里 `eval(引擎块 + 测试代码)` 跑差分测试/达成率统计(注意引擎块开头有 `'use strict'`,eval 作用域内定义,测试代码要拼在同一个 eval 字符串里)。
- UI 层函数冒烟测试:从 index.html 用正则提取目标函数文本,配最小 `document`/`localStorage` stub 后 eval(本会话用此法验证过 `trySeedEgg`、`applyTheme`、`allEndingsUnlocked`)。

## 部署(GitHub Pages)

- 站点:https://trangphamcute333-dotcom.github.io/gaozhong-simulator/ ,远端 `origin` = github.com/trangphamcute333-dotcom/gaozhong-simulator,推 `main` 分支即上线(1-2 分钟生效)。
- 推送命令:`git push origin main`;提交信息为一句中文特性总结。
- **网络与凭据(已配置好)**:本机直连 GitHub 被墙,靠 **Steam++(Watt Toolkit)** 加速器:hosts 把 github 域名指向 127.0.0.1,由其本地 443 端口反向代理。本仓库已配置 `http.sslBackend=openssl` + `http.sslCAInfo=C:/Users/LENOVO/steampp-ca.pem`(加速器根证书,从 TLS 握手链/Windows 证书库导出);凭据由 gh 提供(`gh auth setup-git` 已配置,账户 trangphamcute333-dotcom)。推送前可用 `git ls-remote origin` 验证连通。**Steam++ 未运行则 GitHub 全断**;若证书失效,重新导出链中根证书到该路径即可。注意:curl/schannel 的 TLS 指纹会被加速器拒绝,只有浏览器与 git(openssl 后端)可用。

## 代码风格

- 引擎与 UI 均为 ES5 风格(`var`/`function`,不用箭头函数与模板字符串)。
- UI 文案、注释、事件文本全中文;结局/事件文案带有心理援助热线等敏感内容措辞,修改时保持克制。
- 行尾 LF;`git add` 时出现的 CRLF 警告属正常现象,不必处理。
