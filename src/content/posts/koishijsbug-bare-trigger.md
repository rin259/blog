---
title: koishijs神秘bug （其实是bare-trigger插件实现
published: 2026-07-31T01:37:57.968Z
description: idk
tags:
  - koishijs
  - 技术分析
pinned: false
---

我用 koishi 搭 QQ bot，QQ 号和 AstrBot、Luna 共享一个 NapCat（v4.18.9）实例，三个 bot 通过不同的 reverse WebSocket 接 NapCat：

* AstrBot：ws\://127.0.0.1:8997
* Luna (NoneBot2)：ws\://127.0.0.1:6199
* Koishi：ws\://127.0.0.1:6700
  `music-voice` 插件的命令名是 `163`，私聊发 `163 wannacry` 能正常返回搜索结果，群聊发同样的消息却完全没反应。NapCat 日志清楚显示 koishi 收不到任何 `发送 ->` 输出，但群里的 `help` 又能正常响应，这个差异让我意识到而是它根本没把群消息当指令

## koishi 默认群里要 prefix 或 @bot 本体

翻 koishi core（`@koishijs/core/lib/index.cjs:1275`）：

```ts
ctx.before("attach", (session) => {
const { hasAt, appel } = session.stripped;
if (!appel && hasAt) return;
let content = session.stripped.content;
for (const prefix of this._resolvePrefixes(session)) {

          .tina-code-block .hljs-comment,
          .tina-code-block .hljs-code,
          .tina-code-block .hljs-formula { color: #6a737d; }
          .tina-code-block .hljs-keyword,
          .tina-code-block .hljs-doctag,
          .tina-code-block .hljs-template-tag,
          .tina-code-block .hljs-template-variable,
          .tina-code-block .hljs-type,
          .tina-code-block .hljs-variable.language_ { color: #d73a49; }
          .tina-code-block .hljs-title,
          .tina-code-block .hljs-title.class_,
          .tina-code-block .hljs-title.class_.inherited__,
          .tina-code-block .hljs-title.function_ { color: #6f42c1; }
          .tina-code-block .hljs-attr,
          .tina-code-block .hljs-attribute,
          .tina-code-block .hljs-literal,
          .tina-code-block .hljs-meta,
          .tina-code-block .hljs-number,
          .tina-code-block .hljs-operator,
          .tina-code-block .hljs-selector-attr,
          .tina-code-block .hljs-selector-class,
          .tina-code-block .hljs-selector-id,
          .tina-code-block .hljs-variable { color: #005cc5; }
          .tina-code-block .hljs-regexp,
          .tina-code-block .hljs-string,
          .tina-code-block .hljs-meta_.hljs-string { color: #0366d6; }
          .tina-code-block .hljs-built_in,
          .tina-code-block .hljs-symbol { color: #e36209; }
          .tina-code-block .hljs-name,
          .tina-code-block .hljs-quote,
          .tina-code-block .hljs-selector-tag,
          .tina-code-block .hljs-selector-pseudo { color: #22863a; }
          .tina-code-block .hljs-emphasis { font-style: italic; }
          .tina-code-block .hljs-strong { font-weight: bold; }
          .tina-code-block .hljs-section { font-weight: bold; color: #005cc5; }
          .tina-code-block .hljs-bullet { color: #735c0f; }
          .tina-code-block .hljs-addition { background: #f0fff4; color: #22863a; }
          .tina-code-block .hljs-deletion { background: #ffeef0; color: #b31d28; }
          .slate-code_line > span:last-child {margin-right: 1rem;}
        if (!content.startsWith(prefix)) continue;


session.stripped.prefix = prefix;


content = content.slice(prefix.length);


break;

Plain Text


}
...
});
```

紧接着是 `inferCommand`（`index.cjs:1446`）：

```ts
inferCommand(argv) {
if (!argv) return;
if (argv.command) return argv.command;
...
const isStrict = this.config.prefixMode === "strict" || !isDirect && !stripped.appel;
if (argv.root && stripped.prefix === null && isStrict) return;  // ← 群里裸消息栽在这
...
}
```

逻辑链是这样的：

| 场景                                                                                                                                                                                                             | `isDirect` | `stripped.prefix` | `stripped.appel` | `inferCommand` 行为                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------- | ---------------- | --------------------------------------------- |
| 私聊裸 `163`                                                                                                                                                                                                      | `true`     | `null`            | `false`          | 直接走 token 匹配 → ✅                              |
| 群聊裸 `163`                                                                                                                                                                                                      | `false`    | `null`            | `false`          | `isStrict=true && prefix===null` → return → ❌ |
| 群聊 `/163`                                                                                                                                                                                                      | `false`    | `'/'`             | `false`          | prefix 已经被 attach 剥过 → ✅                      |
| 群聊 `@bot 163`                                                                                                                                                                                                  | `false`    | `null`            | `true`           | appel=true 短路掉 isStrict → ✅                   |
| `help` 在群里能用，是因为 plugin-help 用了 `cmd.shortcut('help', { fuzzy: true })`，注册到了 koishi 的 matcher 池里，**绕开**了 `inferCommand` 的 prefix 判定 `music-voice` 这种用 `ctx.command('163 ...')` 正常注册的命令，必须走 `inferCommand`，于是踩坑 |            |                   |                  |                                               |
| 我先把 `koishi.yml` 顶层的 `prefix: []` 改成 `prefix: ''` / `prefix: ['']`，想给所有消息加个"空前缀"——配置加载确实生效了（`commander.config.prefix` = `[""]`），但 `stripped.prefix` 依然是 `null`。                                                |            |                   |                  |                                               |

## attach hook 在多 ctx 下被 filter 掉了

koishi 用的是 [cordis](https://github.com/cordiverse/cordis) 作为 hook 框架，每个 plugin 都活在独立 ctx scope 里。`Commander` 是在 koishi app 启动时（`provide("$commander", new Commander(this, ...))`）注册 hook，hook 的 ctx 落在 root scope 上
但 `session`（每个 message event 的 `thisArg`）是从 `adapter-onebot` 来的，session 的 ctx 落在 adapter 的 ctx scope 下。
cordis 的 `Lifecycle.filterHooks`（`@cordisjs/core/lib/index.cjs:500`）：

```ts
filterHooks(hooks, thisArg) {
thisArg = getTraceable(this.ctx, thisArg);
return hooks.slice().filter((hook) => {

          .tina-code-block .hljs-comment,
          .tina-code-block .hljs-code,
          .tina-code-block .hljs-formula { color: #6a737d; }
          .tina-code-block .hljs-keyword,
          .tina-code-block .hljs-doctag,
          .tina-code-block .hljs-template-tag,
          .tina-code-block .hljs-template-variable,
          .tina-code-block .hljs-type,
          .tina-code-block .hljs-variable.language_ { color: #d73a49; }
          .tina-code-block .hljs-title,
          .tina-code-block .hljs-title.class_,
          .tina-code-block .hljs-title.class_.inherited__,
          .tina-code-block .hljs-title.function_ { color: #6f42c1; }
          .tina-code-block .hljs-attr,
          .tina-code-block .hljs-attribute,
          .tina-code-block .hljs-literal,
          .tina-code-block .hljs-meta,
          .tina-code-block .hljs-number,
          .tina-code-block .hljs-operator,
          .tina-code-block .hljs-selector-attr,
          .tina-code-block .hljs-selector-class,
          .tina-code-block .hljs-selector-id,
          .tina-code-block .hljs-variable { color: #005cc5; }
          .tina-code-block .hljs-regexp,
          .tina-code-block .hljs-string,
          .tina-code-block .hljs-meta_.hljs-string { color: #0366d6; }
          .tina-code-block .hljs-built_in,
          .tina-code-block .hljs-symbol { color: #e36209; }
          .tina-code-block .hljs-name,
          .tina-code-block .hljs-quote,
          .tina-code-block .hljs-selector-tag,
          .tina-code-block .hljs-selector-pseudo { color: #22863a; }
          .tina-code-block .hljs-emphasis { font-style: italic; }
          .tina-code-block .hljs-strong { font-weight: bold; }
          .tina-code-block .hljs-section { font-weight: bold; color: #005cc5; }
          .tina-code-block .hljs-bullet { color: #735c0f; }
          .tina-code-block .hljs-addition { background: #f0fff4; color: #22863a; }
          .tina-code-block .hljs-deletion { background: #ffeef0; color: #b31d28; }
          .slate-code_line > span:last-child {margin-right: 1rem;}
        const filter = thisArg?.\[Context.filter];


return hook.global || !filter || filter.call(thisArg, hook.ctx);

Plain Text


});
}
```

当 `thisArg`（session）带 `Context.filter` 时，hook.ctx **必须** 落在 session ctx 的可达 scope 里才会执行。我直接 patch `@koishijs/core/lib/index.cjs` 在 `Commander` 的 attach hook 里塞 `console.log`，启动 koishi、群聊发消息——**日志一条都没打出来**。但我自己写的 plugin 注册的 `ctx.before('attach', ...)` 在同一条消息上能触发
也就是说：**Commander 的 attach hook 在群消息路径上从来没被调用过**。这就把 `stripped.prefix` 一直留在初始的 `null`，后续所有逻辑都被短路
koishi 1.0 时代 core 自己直接 root 注册 hook 应该没问题，2.x/4.x 把 ctx 隔离做细之后，这个 hook 的注册 scope 看起来需要被显式 patch 上去。社区里搜到的所有"群消息不响应"issue，最后都是用户加 prefix 或 @bot 凑合过去，没人去诊断 `filterHooks` 的细节

## 解决方法是写一个本地插件做一个类似裸触发器的东西 dispatch 掉它

绕开 cordis 的 filter 链最干净的做法：在 plugin 自己的 ctx 里直接接管 message 分发，不依赖 koishi core 的 attach/inferCommand 流程
**`/opt/koishi-app/plugins/koishi-plugin-bare-trigger/package.json`**：

```json
{
"name": "koishi-plugin-bare-trigger",
"version": "0.0.1",
"main": "index.js",
"koishi": {

          .tina-code-block .hljs-comment,
          .tina-code-block .hljs-code,
          .tina-code-block .hljs-formula { color: #6a737d; }
          .tina-code-block .hljs-keyword,
          .tina-code-block .hljs-doctag,
          .tina-code-block .hljs-template-tag,
          .tina-code-block .hljs-template-variable,
          .tina-code-block .hljs-type,
          .tina-code-block .hljs-variable.language_ { color: #d73a49; }
          .tina-code-block .hljs-title,
          .tina-code-block .hljs-title.class_,
          .tina-code-block .hljs-title.class_.inherited__,
          .tina-code-block .hljs-title.function_ { color: #6f42c1; }
          .tina-code-block .hljs-attr,
          .tina-code-block .hljs-attribute,
          .tina-code-block .hljs-literal,
          .tina-code-block .hljs-meta,
          .tina-code-block .hljs-number,
          .tina-code-block .hljs-operator,
          .tina-code-block .hljs-selector-attr,
          .tina-code-block .hljs-selector-class,
          .tina-code-block .hljs-selector-id,
          .tina-code-block .hljs-variable { color: #005cc5; }
          .tina-code-block .hljs-regexp,
          .tina-code-block .hljs-string,
          .tina-code-block .hljs-meta_.hljs-string { color: #0366d6; }
          .tina-code-block .hljs-built_in,
          .tina-code-block .hljs-symbol { color: #e36209; }
          .tina-code-block .hljs-name,
          .tina-code-block .hljs-quote,
          .tina-code-block .hljs-selector-tag,
          .tina-code-block .hljs-selector-pseudo { color: #22863a; }
          .tina-code-block .hljs-emphasis { font-style: italic; }
          .tina-code-block .hljs-strong { font-weight: bold; }
          .tina-code-block .hljs-section { font-weight: bold; color: #005cc5; }
          .tina-code-block .hljs-bullet { color: #735c0f; }
          .tina-code-block .hljs-addition { background: #f0fff4; color: #22863a; }
          .tina-code-block .hljs-deletion { background: #ffeef0; color: #b31d28; }
          .slate-code_line > span:last-child {margin-right: 1rem;}
        "description": { "zh": "让群消息像私聊一样裸触发 koishi 已注册命令" }

Plain Text


}
}
```

**`/opt/koishi-app/plugins/koishi-plugin-bare-trigger/index.js`**：

```js
const k = require('@koishijs/core')
module.exports = {
apply(ctx) {

          .tina-code-block .hljs-comment,
          .tina-code-block .hljs-code,
          .tina-code-block .hljs-formula { color: #6a737d; }
          .tina-code-block .hljs-keyword,
          .tina-code-block .hljs-doctag,
          .tina-code-block .hljs-template-tag,
          .tina-code-block .hljs-template-variable,
          .tina-code-block .hljs-type,
          .tina-code-block .hljs-variable.language_ { color: #d73a49; }
          .tina-code-block .hljs-title,
          .tina-code-block .hljs-title.class_,
          .tina-code-block .hljs-title.class_.inherited__,
          .tina-code-block .hljs-title.function_ { color: #6f42c1; }
          .tina-code-block .hljs-attr,
          .tina-code-block .hljs-attribute,
          .tina-code-block .hljs-literal,
          .tina-code-block .hljs-meta,
          .tina-code-block .hljs-number,
          .tina-code-block .hljs-operator,
          .tina-code-block .hljs-selector-attr,
          .tina-code-block .hljs-selector-class,
          .tina-code-block .hljs-selector-id,
          .tina-code-block .hljs-variable { color: #005cc5; }
          .tina-code-block .hljs-regexp,
          .tina-code-block .hljs-string,
          .tina-code-block .hljs-meta_.hljs-string { color: #0366d6; }
          .tina-code-block .hljs-built_in,
          .tina-code-block .hljs-symbol { color: #e36209; }
          .tina-code-block .hljs-name,
          .tina-code-block .hljs-quote,
          .tina-code-block .hljs-selector-tag,
          .tina-code-block .hljs-selector-pseudo { color: #22863a; }
          .tina-code-block .hljs-emphasis { font-style: italic; }
          .tina-code-block .hljs-strong { font-weight: bold; }
          .tina-code-block .hljs-section { font-weight: bold; color: #005cc5; }
          .tina-code-block .hljs-bullet { color: #735c0f; }
          .tina-code-block .hljs-addition { background: #f0fff4; color: #22863a; }
          .tina-code-block .hljs-deletion { background: #ffeef0; color: #b31d28; }
          .slate-code_line > span:last-child {margin-right: 1rem;}
        ctx.on('message', async (session) => {


  //私聊不需要这个插件（私聊本身就能裸触发）
  if (session.stripped?.isDirect) return
  //已经有 prefix 或 @bot，走 koishi 自带路径
  if (session.stripped?.prefix !== null) return
  if (session.stripped?.hasAt || session.stripped?.appel) return
  let content = session.stripped?.content
  if (!content) return
  if (content.startsWith('/')) content = content.slice(1)
  const at = content.match(/^@\S+\s+/)
  if (at) content = content.slice(at\[0].length)
  const first = content.split(/\s+/, 1)\[0]
  if (!first) return
  if (!ctx.app.$commander.get(first, session)) return
  try {
    //关键：把 prefix 临时设为空字符串，
    //否则 inferCommand 里的 "stripped.prefix === null && isStrict" 会 return
    session.stripped.prefix = ''
    const argv = k.Argv.parse(content)
    argv.session = session
    argv.root = true
    ctx.app.$commander.inferCommand(argv)
    await session.execute(argv)
  } catch {}
})
Plain Text


}
}
```

**symlink + koishi.yml 注册**：

```bash
ln -s ../plugins/koishi-plugin-bare-trigger /opt/koishi-app/node_modules/koishi-plugin-bare-trigger
```

`koishi.yml` 里在 `adapter-onebot` 后面加一行：

```yaml
adapter-onebot:8fxdaw:
selfId: '32******38'
protocol: ws
endpoint: ws://127.0.0.1:6700
token: '***'
bare-trigger:bare01: {}
```

重启 koishi：

```bash
systemctl restart koishi-app.service
```

## 效果

napcat 日志里看到：

```
08:04:45 [info] OwO | 接收 <- 群聊 [...rin's lab...] [Rin] 163 1
08:04:46 [info] OwO | 发送 -> 群聊 [...rin's lab...] [OwO(3251380238)] [图片] 退出选择请发送 [0, 不听了] 中的任意内容 ...
```

群消息裸触发 100% 跟私聊一致，私聊行为不变，已有 prefix / @bot 的命令也不冲突（plugin 在第一步 return 掉了）。

## 后话

回过头看，`prefix: ['']` 这个修复其实**方向是对的**，但被 koishi core attach hook 没触发的事实掩盖了——配置生效了但路径走不到。如果哪天 koishi 修了 attach hook 的 scope 问题，这条 `prefix: ['']` 也能独立工作。但裸触发这个用例，最好的实现还是 plugin：它更显式 更可控 不依赖 koishi 内部的 hook 拓扑
如果你也遇到群里自定义命令不响应的问题，可以照上面三步走 (o´・ω・`)σ)Д`)
