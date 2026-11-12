# dsh-tibo-reset-watch

A corner card inside DeepSeek Harness that shows what a watched X account just said — translated into Chinese.

The card sits at the top-right edge as a small badge, pops open when a new post or reply arrives, and folds back to the badge once you have looked at every row. All fetching and translating happens on the Host side: no agent turn is started, no conversation token is spent, and nothing happens while the window is closed.

Ships with a **Tibo preset** (`@thsottiaux`): the Codex usage-limit rescues usually surface on his timeline first, so the preset tracks that timeline minute by minute. The same card can display any other source you configure.

## Install

```sh
dsh plugin add dsh-tibo-reset-watch
```

Published on npm. If you would rather track a commit than a release, the GitHub form works too — `dsh plugin add github:593682963wd-wq/dsh-tibo-reset-watch` — but the first run then asks for build-script approval, so follow the hint `dsh` prints and retry.

Restart DeepSeek Harness if the badge does not appear within a minute.

## What it does

- Polls every 3 minutes (configurable) and de-duplicates by post id.
- Shows the newest rows first; hovering a row or clicking it marks it read.
- For replies, a `看原帖 ▾` button expands the post being replied to, fetched through the keyless [fxtwitter](https://github.com/FixTweet/FxTwitter) API.
- Adds a `◆ RESET` marker to rows whose text mentions a usage-limit reset, quota or outage.
- Translates through the Host translation service when one is installed. Without a translation service the card still works and simply shows the original text.

## Configuration

The first run writes `~/.dsh/tibo-reset-watch/config.json`:

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

| Field | Meaning |
| --- | --- |
| `accounts` | One or more sources to watch; every entry with `"enabled": true` is polled and merged into the same card. |
| `sourceType` | `tiboreset` reads the markdown timeline page of a `tiboreset` mirror; `json` reads a plain JSON endpoint. |
| `sourceUrl` | The URL to fetch. |
| `pollMinutes` | Poll interval in minutes (minimum 1). |
| `keep` | How many rows to retain locally (minimum 5). |
| `translate` | Set to `false` to keep the original language only. |
| `cardTop` | Distance from the top of the window in pixels, so the card can avoid other overlays. |

A `json` source must return one of these shapes:

```json
{ "posts": [ { "id": "123", "text": "hello", "createdAt": "2026-01-01T00:00:00Z" } ] }
```

`{ "items": [...] }`, `{ "data": [...] }` and a bare array are accepted as well. Recognised keys per entry: `id`, `text` (or `content`), `createdAt` (or `created_at`, `date`), `replyTo`, `replyToId`, `stats`.

After editing the configuration, reload the window. No DeepSeek Harness restart is needed.

## Data source, limits and disclaimer

The built-in preset reads **tiboreset.com**, a third-party public text mirror of an X timeline. It is not an X API and not affiliated with X or OpenAI:

- the mirror lags the live timeline by a few minutes;
- it keeps roughly the last two days of posts, so a long offline period loses the gap;
- it exposes text only — images, videos and reposts are not shown;
- it can change or go away at any time; when it does, the card shows `OFFLINE` and the original rows stay readable.

Text and links belong to their authors. This plugin is a personal reader: it stores rows locally under `~/.dsh/tibo-reset-watch/` and sends nothing anywhere except the fetch of the source URL, the optional quote lookup and the translation request.

## Privacy and data flow

Fetched and stored data stays on your machine, with one exception: the text that gets translated.

- The Host makes only these outbound requests: your configured `sourceUrl`, `api.fxtwitter.com/status/<id>` when you expand a reply, and the Host translation service.
- Depending on how your DSH installation routes translation, post text may reach a public provider (Google or Bing). Set `"translate": false` in the config to fully disable translation and keep every post local.
- Posts and read state live in `~/.dsh/tibo-reset-watch/` and the browser's `localStorage`.
- The plugin never reads credentials, API keys, workspace files, session history or other application data.
- It runs with the permissions of any DSH plugin; reading `index.js` and `client.js` is enough to verify what it does.

## Files

| Path | Purpose |
| --- | --- |
| `index.js` | Host half: polling, parsing, translation, `/tibo-reset-watch/feed` route, state under `~/.dsh/tibo-reset-watch/` |
| `client.js` | Client half: the card, the badge and read state in `localStorage` |
| `cordis.patch.yml` | Bundle patch that inserts the plugin |
| `locale/*.json` | Plugin title and description |

Editing `index.js` takes effect after restarting DeepSeek Harness; editing `client.js` takes effect after a page reload.

## License

MIT
