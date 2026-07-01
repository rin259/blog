---
title: "记一次SSH反向隧道重启失效"
published: 2026-06-21
description: "最近在尝试把本机的 SSH 服务通过远端公网服务器暴露出去，原本以为只需配置一条转发命令，但系统重启后却遇到了无法连接的问题。排查过程中顺带处理了几个 OpenSSH 和 Systemd 的配置细节，同时还定位到了一个由高负载引起的进程离线隐患。今天把整个排查和修复过程记录下来，供日后参考。 (为保"
tags: ["SSH", "Linux", "运维", "网络"]
category: "随笔"
draft: false
---

最近在尝试把本机的 SSH 服务通过远端公网服务器暴露出去，原本以为只需配置一条转发命令，但系统重启后却遇到了无法连接的问题。排查过程中顺带处理了几个 OpenSSH 和 Systemd 的配置细节，同时还定位到了一个由高负载引起的进程离线隐患。今天把整个排查和修复过程记录下来，供日后参考。

*(为保护窝的隐私，本文中的 IP、端口和用户名均已做脱敏处理，统一使用占位符表示。)*

---

## 需求背景与异常现象

我的诉求是在本机建立一个反向隧道，通过远端服务器的公网 IP 登录回本机。

- **本机 SSH 监听端口**：127.0.0.1:<转发端口>
- **远端公网 IP**：<公网IP> （内网地址：<内网IP>）
- **远端稳定控制 SSH 端口**：<控制端口>
- **期望连接入口**：`ssh -p <转发端口> <用户名>@<公网IP>` （期望通过 <内网IP>:<转发端口> 回连到本机）

**现象：**
系统重启后，使用客户端连接期望入口时，无论输入什么密码都提示密码错误。

检查本机的反向隧道服务日志，发现服务在持续报错重试，提示远程端口转发失败。同时，远端服务器的日志中显示了无效用户登录失败的记录。

原因很明显：客户端的连接并没有通过隧道回到本机，而是直接落到了远端服务器自己的 sshd 服务上。远端环境并没有 <用户名> 这个用户，因此表现为密码错误。

---

## 核心问题：远端端口冲突

导致请求落到远端的原因，是远端公网端口 <转发端口> 的用途产生了冲突：既被用作用户的连接入口，又被用作本机反向隧道连接远端时使用的控制端口。

同一个 IP 的同一个 TCP 端口，不能同时由远端 sshd 监听并由反向隧道转发到本机 sshd。系统重启后，远端的自带服务会先一步启动并绑定该端口。此时用户连接，自然进入了远端环境。与此同时，本机反向隧道尝试绑定同一个远端端口失败，导致隧道无法建立。

---

## 意外插曲：系统高负载与进程掉线

在排查端口冲突的过程中，我还注意到作为转发终点的本机 CachyOS 系统出现了一个并发症状：系统资源占用持续处于高位，且部分进程出现了阶段性的离线或重启。

起初我怀疑是反向隧道配置错误导致的网络死循环耗尽了资源，但调取监控和系统日志后发现，问题出在本机运行的其他高强度后台任务上。

当时这台机器正在运行reranker任务，对计算性能和内存的消耗都非常大。当系统内存资源耗尽时，内核触发了 OOM 机制，导致部分后台业务进程被强制终止，表现为进程的阶段性离线，包括 owo bot 的四套 service 和 Nginx。

更严重的是，在处理器长时间满负荷运转的情况下，网络心跳包的发送出现了延迟。这导致底层的 sshd 响应变慢，SSH 隧道本身也可能因超时而断开，从侧面加剧了远程连接失败的现象。

为了解决这个并发隐患，我采取了两个优化措施：

1. 利用 cgroups 对 CPU 计算任务和视频生成流水线进行资源隔离，限制其最大内存和处理器的占用率。
2. 在 SSH 反向隧道服务的 systemd 配置中加入 `OOMScoreAdjust=-1000`，降低其被系统强制终止的概率，确保在资源吃紧时，远程连接通道依然稳定。

---

## 修复过程中的三个配置细节

在调整网络配置的过程中，还遇到了几个需要注意的规则：

### 1. PermitListen 的多行写法未按预期生效

为了限制反向隧道的监听地址，最初尝试分行配置允许监听的 IP 和端口。但系统只读取了第一条记录，导致后续地址仍被拒绝。
正确做法是将所有允许项写在同一行，用空格分隔：
`PermitListen <内网IP>:<转发端口> 127.0.0.1:<转发端口>`

### 2. 修改远端 sshd 配置必须 reload

将新配置写入 `/etc/ssh/sshd_config.d/*.conf` 后，已经运行的远端 sshd 是不会自动读取的。如果不重新加载，反向隧道仍会被旧的规则拦截。修改完成后，必须执行语法检查并重载服务。

### 3. systemd unit 中避免使用格式化占位符

为了自动化部署，尝试在本机的 systemd unit 中写入带有 `%s` 的输出命令。但 systemd 会将其解析为特定的运行时变量并展开，直接损坏了远端配置文件。在 unit 文件里应避免使用 `%s`，或者写成 `%%s` 进行转义。

---

## 最终修复方案：Systemd Service 配置

基于以上排查，重新确立了网络设计原则，并将防范 OOM 被杀的逻辑补充了进去：

- 控制连接端口和用户访问端口彻底分离。
- 本机服务每次启动前，自动登录远端修复配置并停用冲突服务。

以下是本机最终采用的 systemd 服务配置：

```
[Unit]
Description=Reverse SSH tunnel to remote server for local SSH access
Wants=network-online.target
After=network-online.target sshd.service
StartLimitIntervalSec=0
​
[Service]
Type=simple
User=<用户名>
Environment="HOME=/home/<用户名>"
# 降低被 OOM Killer 终止的概率，确保高负载下隧道存活
OOMScoreAdjust=-1000
# 每次启动前登录远端进行自修复：写入配置、重载sshd、并停用冲突服务
ExecStartPre=/usr/bin/ssh -p <控制端口> -o BatchMode=yes -o ConnectTimeout=20 -o ConnectionAttempts=1 -o StrictHostKeyChecking=accept-new root@<公网IP> "set -eu; printf 'AllowTcpForwarding yes\nGatewayPorts clientspecified\nPermitListen <内网IP>:<转发端口> 127.0.0.1:<转发端口>\n' > /etc/ssh/sshd_config.d/99-reverse-tunnel-gatewayports.conf; /usr/sbin/sshd -t; systemctl reload ssh.service || systemctl restart ssh.service; systemctl disable --now ssh-public-<转发端口>.service >/dev/null 2>&1 || true"
# 启动实际的反向隧道
ExecStart=/usr/bin/ssh -NT -C -p <控制端口> -o BatchMode=yes -o ConnectTimeout=20 -o ConnectionAttempts=1 -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o StrictHostKeyChecking=accept-new -R <内网IP>:<转发端口>:127.0.0.1:<转发端口> root@<公网IP>
Restart=always
RestartSec=10
​
[Install]
WantedBy=multi-user.target
```

---

## 验证与排障参考

配置完成后，建议通过对比底层的 Host Key 来确认是否生效。提取目标公网端口返回的指纹，与本机真实的指纹进行对比，两边输出一致则说明连接已经成功穿透到本机。

### 常见问题排障表

| 现象 | 可能原因 | 检查方法 | 修复方向 |
| --- | --- | --- | --- |
| 连接时密码错误 | 实际连接到了远端 sshd | 使用 ssh-keyscan 对比 host key | 禁用远端冲突服务，让反向隧道正常绑定 |
| 远程端口转发失败 | 远端端口被占用或被配置拒绝 | 本机查看 systemd 服务运行日志 | 停止冲突进程，修正 PermitListen 白名单 |
| 修改配置后未生效 | 远端 sshd 服务未重载 | 远端查看 ssh 服务日志状态 | 远端执行 systemctl reload 重新加载配置 |
| 进程阶段性无响应 | 本机后台高耗能任务触发 OOM | 查看内核日志 dmesg 或系统负载 | 配置 cgroups 隔离资源，调整服务 OOM 优先级 |
| 重启后问题复现 | 修复操作仅手动执行未自动化 | 检查本机 systemd unit 文件 | 将远端的环境清理逻辑硬编码进 ExecStartPre |

如果在其他机器部署，核心思路依然是保持控制通道与访问通道的物理端口分离，并在启动阶段加入环境自检与自动清理机制，这样可以规避大部分因意外重启导致的连接断开问题。
