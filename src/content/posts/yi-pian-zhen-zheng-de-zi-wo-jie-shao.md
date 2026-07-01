---
title: "一篇真正的自我介绍"
published: 2025-04-15
description: "我的网名是rin，它来源于Porter Robinson一首叫做Shelter曲目的MV 记忆真是深刻啊，关于这个mv我是在高中时候第一次看到的，深刻于它的超现实世界框架..啊扯远了..... 我喜欢DevOps，LAMP Stack，PHP，Python，尤其是Python优秀的包管理器pip.."
tags: ["随笔", "关于我"]
category: "随笔"
draft: false
---

我的网名是rin，它来源于Porter Robinson一首叫做Shelter曲目的MV

记忆真是深刻啊，关于这个mv我是在高中时候第一次看到的，深刻于它的超现实世界框架..啊扯远了.....

我喜欢DevOps，LAMP Stack，PHP，Python，尤其是Python优秀的包管理器pip...(?)

我在自己家部署了linux机器，同时也使用了一些优秀的聊天机器人框架实现，就比如OwO，熟悉认识我的人可能已经用过了，也用了我认为很成功的AList，假设自己托管SLA没有问题再去挂载例如aliyunpan open之类的存储提供商，可用性还是很高的ovo

我喜欢令我一时琢磨不透的新奇东西，再去学习后那种成就感是很不错的，i like that.

有时候我觉得代码仓库里的commit history比这篇博客更诚实，那些深夜强行push的垃圾代码，那些被revert的废话注释，还有某次迷迷糊糊之后写的诡异正则表达式——像不像数字时代的非主流文学...？

你知道最讽刺的是什么吗？我们这代人用k8s docker编排着几百个容器，却搞不定出租屋里的智能电表，米家那样的智能网关。上次openwrt崩溃时，我蹲在路由器前用手机热点查文档的样子hh，像MV里那个对着废墟敲打键盘的rin..

最近在写一个自毁式日志系统，当df检测到sda空间不足时

```
#!/bin/bash

THRESHOLD=10

AVAILABLE_SPACE=$(df /dev/sda | awk 'NR==2 {print $4}' | sed 's/G//')

if (( $(echo "$AVAILABLE_SPACE < $THRESHOLD" | bc -l) )); then
  echo "警告：/dev/sda 空间不足，可用空间为 $AVAILABLE_SPACE G，正在清理 /tmp 目录..."
  rm -rf /tmp/*
  echo "/tmp 目录已清理完成."
else
  echo "/dev/sda 空间充足."
fi
```

会优先删除我自己放在这里的那些没实现的想法。这算不算某种数字层面的...自我和解？关于没有完善它们之类的

真是着迷，这种在抽象深渊边缘试探的眩晕感。把SOS编译成JSON，用HTTP状态码形似与意义上的哭泣，在CI/CD流水线里刻下到此一游...

P. S. 真是抽象的自我介绍lmao bro以为他是意识流写手把self introduction写的似乎有点flow了
