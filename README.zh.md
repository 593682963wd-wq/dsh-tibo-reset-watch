# dsh-tibo-reset-watch

DeepSeek Harness 右上角的账号动态卡片：关注的 X 账号一有新帖或回复就弹出，配中文译文。

收起时是一个小角标；有新内容自动展开，每条都看过之后自动折回。抓取和翻译都在 Host 侧完成：不启动 Agent 会话、不消耗对话 token，窗口关掉就不动。

内置 **Tibo 预设**（`@thsottiaux`）：Codex 的额度重置消息通常最先出现在他的时间线上，所以预设按分钟盯这条线。同一张卡片也可以显示你自己配置的其他数据源。

## 安装

```sh
dsh plugin add dsh-tibo-reset-watch
```

一分钟内没看到角标就重启一次 DeepSeek Harness。

## 它做什么

- 每 3 分钟（可配）抓一次，按帖子 id 去重。
- 新的排前面；鼠标滑过或点开一条即标为已读。
- 回复类帖子可点「看原帖 ▾」，通过免 key 的 [fxtwitter](https://github.com/FixTweet/FxTwitter) 接口取回被回复的那条。
- 正文里提到额度重置、配额或故障的，会打一个 `◆ RESET` 标。
- 翻译走 Host 的翻译服务；没装翻译服务也能用，只显示原文。

## 配置

首次运行会生成 `~/.dsh/tibo-reset-watch/config.json`：

```json
{
  "accounts": [
    {
      "id": "tibo",
      "label": "Tibo",
      "handle": "thsottiaux",
      "sourceType": "tiboreset",
      "sourceUrl": "https://tiboreset.com/X-posts",
      "enabled": true
    }
  ],
  "pollMinutes": 3,
  "keep": 40,
  "translate": true,
  "sourceLanguage": "en",
  "targetLanguage": "zh-CN",
  "cardTop": 74
}
```

| 字段 | 含义 |
| --- | --- |
| `accounts` | 要盯的数据源，所有 `enabled: true` 的会被轮询并合并进同一张卡片 |
| `sourceType` | `tiboreset` 读镜像站的 markdown 时间线；`json` 读普通 JSON 接口 |
| `sourceUrl` | 要抓的地址 |
| `pollMinutes` | 轮询间隔，分钟，最小 1 |
| `keep` | 本地保留多少条，最小 5 |
| `translate` | 设为 `false` 只保留原文 |
| `cardTop` | 距窗口顶部多少像素，用来避开其他浮层 |

`json` 源支持这三种外形：

```json
{ "posts": [ { "id": "123", "text": "hello", "createdAt": "2026-01-01T00:00:00Z" } ] }
```

`{ "items": [...] }`、`{ "data": [...] }` 或裸数组都可以。每条认这些字段：`id`、`text`（或 `content`）、`createdAt`（或 `created_at`、`date`）、`replyTo`、`replyToId`、`stats`。

改完配置刷新窗口即可，不需要重启 DeepSeek Harness。

## 数据源、限制与免责

内置预设读的是 **tiboreset.com**——一个第三方公开的 X 时间线文字镜像，不是 X 官方 API，也与 X、OpenAI 无关：

- 比实时时间线晚几分钟；
- 只保留最近约两天，电脑关机太久中间那段补不回来；
- 只有文字，图片、视频、转推不显示；
- 随时可能改版或消失。真挂了卡片会显示 `OFFLINE`，已经抓到的内容仍可阅读。

文字与链接归原作者所有。本插件只是一个本地阅读器：数据存在 `~/.dsh/tibo-reset-watch/`，除了抓数据源、可选的原帖查询和翻译请求之外不向别处发送任何内容。

## 文件

| 路径 | 作用 |
| --- | --- |
| `index.js` | Host：轮询、解析、翻译、`/tibo-reset-watch/feed` 路由、状态存 `~/.dsh/tibo-reset-watch/` |
| `client.js` | Client：卡片、角标、`localStorage` 里的已读状态 |
| `cordis.patch.yml` | 插入插件的 bundle patch |
| `locale/*.json` | 插件标题与描述 |

改 `index.js` 需要重启 DeepSeek Harness 生效；改 `client.js` 刷新页面即可。

## License

MIT
