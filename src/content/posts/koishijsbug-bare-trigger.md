---
title: koishijs神秘bug （其实是bare-trigger插件实现
published: 2026-07-31T01:37:57.968Z
description: idk
tags:
  - koishijs
  - 技术分析
pinned: false
comment: true
---

\# Koishi 群聊裸命令不响应的排查与解决

我用 Koishi 搭 QQ bot，QQ 号和 AstrBot、Luna 共用一个 NapCat 4.18.9 实例。三个 bot 分别通过不同的 reverse WebSocket 连接 NapCat：

\- AstrBot：\`ws\://127.0.0.1:8997\`

\- Luna（NoneBot2）：\`ws\://127.0.0.1:6199\`

\- Koishi：\`ws\://127.0.0.1:6700\`

Koishi 的 \`music-voice\` 插件命令是 \`163\`。

私聊发送：

\`\`\`text

163 wannacry

\`\`\`

可以正常返回搜索结果。群聊发送同样内容却没有任何反应。NapCat 日志里没有 Koishi 对这条消息的 \`发送 ->\` 记录，但群里的 \`help\` 可以正常响应。

这说明问题不在 NapCat 收消息，而在 Koishi 没把群消息当作普通命令处理。

\## 群聊默认需要前缀或 @bot

查看 \`@koishijs/core/lib/index.cjs:1275\` 的 \`attach\` hook，可以看到 Koishi 会先处理前缀：

\`\`\`ts

ctx.before("attach", (session) => {

const { hasAt, appel } = session.stripped;

if (!appel && hasAt) return;

let content = session.stripped.content;

for (const prefix of this.\_resolvePrefixes(session)) {

```
if (!content.startsWith(prefix)) continue;

session.stripped.prefix = prefix;

content = content.slice(prefix.length);

break;
```

}

});

\`\`\`

接下来是 \`inferCommand()\`，位于 \`index.cjs:1446\`：

\`\`\`ts

inferCommand(argv) {

if (!argv) return;

if (argv.command) return argv.command;

// ...

const isStrict =

```
this.config.prefixMode === "strict" ||

(!isDirect && !stripped.appel);
```

if (argv.root && stripped.prefix === null && isStrict) return;

// ...

}

\`\`\`

群聊和私聊的差异如下：

\| 场景 | \`isDirect\` | \`stripped.prefix\` | \`stripped.appel\` | 结果 |

\| --- | --- | --- | --- | --- |

\| 私聊裸 \`163\` | \`true\` | \`null\` | \`false\` | 能继续匹配命令 |

\| 群聊裸 \`163\` | \`false\` | \`null\` | \`false\` | \`inferCommand()\` 直接返回 |

\| 群聊 \`/163\` | \`false\` | \`'/'\` | \`false\` | 前缀已被剥离，可以匹配 |

\| 群聊 \`@bot 163\` | \`false\` | \`null\` | \`true\` | 不触发严格前缀判断，可以匹配 |

群里的 \`help\` 能工作，是因为 \`plugin-help\` 使用了：

\`\`\`ts

cmd.shortcut('help', { fuzzy: true })

\`\`\`

它注册到 Koishi 的 matcher 池，不依赖 \`inferCommand()\` 的前缀判断。\`music-voice\` 使用的是普通的：

\`\`\`ts

ctx.command('163 ...')

\`\`\`

所以必须经过 \`inferCommand()\`，群聊裸命令会在这里被拦下。

\## \`prefix: \['']\` 为什么没有生效

我先尝试在 \`koishi.yml\` 顶层设置空前缀：

\`\`\`yaml

prefix: \['']

\`\`\`

配置加载后，\`commander.config.prefix\` 的确变成了 \`\['']\`，但 \`session.stripped.prefix\` 仍然是 \`null\`。

继续排查后，我发现 Commander 注册的 \`attach\` hook 没有进入群消息路径。

Koishi 使用 Cordis 管理 hook。每个插件运行在自己的 context scope 中。Commander 在应用启动时通过 root scope 注册 hook，而 adapter-onebot 创建的 session 带有 adapter 的 context scope。

Cordis 的 \`Lifecycle.filterHooks()\` 位于 \`@cordisjs/core/lib/index.cjs:500\`：

\`\`\`ts

filterHooks(hooks, thisArg) {

thisArg = getTraceable(this.ctx, thisArg);

return hooks.slice().filter((hook) => {

```
const filter = thisArg?.\[Context.filter];

return hook.global || !filter || filter.call(thisArg, hook.ctx);
```

});

}

\`\`\`

当 session 带有 \`Context.filter\` 时，hook 的 context 必须在 session context 的可达范围内，hook 才会执行。

我直接在 \`@koishijs/core/lib/index.cjs\` 的 Commander \`attach\` hook 中加入 \`console.log()\`。启动 Koishi 后向群聊发消息，日志没有任何输出。但我自己写的插件通过：

\`\`\`ts

ctx.before('attach', ...)

\`\`\`

注册的 hook 可以在同一条消息上触发。

也就是说，Commander 的 \`attach\` hook 在这条群消息路径上没有执行。\`stripped.prefix\` 保持初始值 \`null\`，随后 \`inferCommand()\` 按严格群聊规则退出。

\## 用本地插件处理群聊裸命令

我没有继续修改 Koishi core，而是写了一个本地插件。

插件在自己的 context 中监听 \`message\`。它只处理以下消息：

\- 群消息

\- 没有前缀

\- 没有 \`@bot\`

\- 第一个 token 是已注册命令

插件将 \`session.stripped.prefix\` 临时设为 \`''\`，然后构造 argv 并调用 \`inferCommand()\` 与 \`session.execute()\`。私聊、有前缀的命令和 \`@bot\` 命令仍由 Koishi 原来的流程处理。

\`/opt/koishi-app/plugins/koishi-plugin-bare-trigger/package.json\`：

\`\`\`json

{

"name": "koishi-plugin-bare-trigger",

"version": "0.0.1",

"main": "index.js",

"koishi": {

```
"description": {

  "zh": "让群消息像私聊一样裸触发 Koishi 已注册命令"

}
```

}

}

\`\`\`

\`/opt/koishi-app/plugins/koishi-plugin-bare-trigger/index.js\`：

\`\`\`js

const k = require('@koishijs/core')

module.exports = {

apply(ctx) {

```
ctx.on('message', async (session) => {

  // 私聊本身可以裸触发，不需要由插件处理。

  if (session.stripped?.isDirect) return

  // 已带前缀或已 @bot 时，继续使用 Koishi 原来的命令流程。

  if (session.stripped?.prefix !== null) return

  if (session.stripped?.hasAt || session.stripped?.appel) return

  let content = session.stripped?.content

  if (!content) return

  if (content.startsWith('/')) {

    content = content.slice(1)

  }

  const at = content.match(/^@\S+\s+/)

  if (at) {

    content = content.slice(at\[0].length)

  }

  const first = content.split(/\s+/, 1)\[0]

  if (!first) return

  if (!ctx.app.$commander.get(first, session)) return

  try {

    // 避免 inferCommand() 因群聊裸消息的严格前缀判断而退出。

    session.stripped.prefix = ''

    const argv = k.Argv.parse(content)

    argv.session = session

    argv.root = true

    ctx.app.$commander.inferCommand(argv)

    await session.execute(argv)

  } catch {}

})
```

},

}

\`\`\`

创建软链接：

\`\`\`bash

ln -s ../plugins/koishi-plugin-bare-trigger /opt/koishi-app/node\_modules/koishi-plugin-bare-trigger

\`\`\`

在 \`koishi.yml\` 中，把插件放在 \`adapter-onebot\` 后面：

\`\`\`yaml

adapter-onebot:8fxdaw:

selfId: '32\*\*\*\*\*\*38'

protocol: ws

endpoint: ws\://127.0.0.1:6700

token: '\*\*\*'

bare-trigger:bare01: {}

\`\`\`

重启 Koishi：

\`\`\`bash

systemctl restart koishi-app.service

\`\`\`

NapCat 日志随后可以看到群聊命令被 Koishi 响应：

\`\`\`text

08:04:45 \[info] OwO | 接收 \<- 群聊 \[...rin's lab...] \[Rin] 163 1

08:04:46 \[info] OwO | 发送 -> 群聊 \[...rin's lab...] \[OwO(32\*\*\*\*\*\*38)] \[图片] 退出选择请发送 \[0, 不听了] 中的任意内容 ...

\`\`\`

现在群聊裸触发和私聊行为一致。私聊不受影响，已有前缀和 \`@bot\` 的命令也不会冲突，因为插件会先跳过这些消息。

\`prefix: \['']\` 的方向本身没有问题。配置虽然生效了，但 Commander 的 \`attach\` hook 没有进入该群消息路径，所以空前缀没有机会写入 \`session.stripped.prefix\`。如果 Koishi 后续修复这个 hook 的 scope 问题，空前缀配置可能可以单独工作。

对这个裸触发场景，本地插件更直观：只处理需要处理的群消息，行为也不依赖 Koishi 内部 hook 的可达关系。
