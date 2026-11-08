/**
 * Host half of Tibo Reset Watch.
 *
 *  - polls configured X/Twitter sources on a timer (no LLM, no agent turn)
 *  - fetches the post a reply answers (fxtwitter, keyless) so the card can show it
 *  - translates text through the Host translation service when one is available
 *  - publishes everything on GET /tibo-reset-watch/feed for the Client overlay
 *
 * Sources are pluggable. Out of the box one `tiboreset` preset is enabled
 * (a public text mirror of @thsottiaux's timeline); any number of plain JSON
 * endpoints can be added in ~/.dsh/tibo-reset-watch/config.json.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const inject = ['webServer']

const STATE_DIR = join(homedir(), '.dsh', 'tibo-reset-watch')
const STATE_FILE = join(STATE_DIR, 'state.json')
const CONFIG_FILE = join(STATE_DIR, 'config.json')
const FEED_PATH = '/tibo-reset-watch/feed'
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'
const FX_API = 'https://api.fxtwitter.com/status/'

const DEFAULT_CONFIG = {
  accounts: [
    {
      id: 'tibo',
      label: 'Tibo',
      handle: 'thsottiaux',
      sourceType: 'tiboreset',
      sourceUrl: 'https://tiboreset.com/X-posts',
      enabled: true,
    },
  ],
  pollMinutes: 3,
  keep: 40,
  translate: true,
  sourceLanguage: 'en',
  targetLanguage: 'zh-CN',
  cardTop: 74,
}

const MAX_TRANSLATE_PER_ROUND = 6
const MAX_QUOTED_PER_ROUND = 5

const HOT_PATTERN = /reset|usage limit|limit reset|quota|outage|额度|重置/i

function idToDate(id) {
  try {
    const ms = Number(BigInt(id) >> 22n) + 1288834974657
    const date = new Date(ms)
    return Number.isFinite(date.getTime()) ? date : null
  } catch (error) {
    return null
  }
}

function beijingLabel(date) {
  if (!date) return ''
  const shifted = new Date(date.getTime() + 8 * 3600 * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
}

function cleanText(text) {
  return String(text || '')
    .replace(/\[@([A-Za-z0-9_]+)\]\(https?:\/\/[^)\s]+\)/g, '@$1')
    .replace(/\[(https?:\/\/[^\]\s]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1')
    .replace(/https?:\/\/t\.co\/\S+/g, '（链接）')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim()
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Parse the markdown mirror page of one account timeline. */
function parseTiboresetMarkdown(md, account) {
  const handle = String(account.handle || '').trim()
  const label = String(account.label || handle || '').trim()
  const linkPattern = handle
    ? new RegExp(`\\[View on X ↗\\]\\(https:\\/\\/x\\.com\\/${escapeRegExp(handle)}\\/status\\/(\\d+)\\)`, 'g')
    : /\[View on X ↗\]\(https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/(\d+)\)/g
  const authorAnchor = label ? `**${label}**` : ''
  const items = []
  const seen = new Set()
  let match
  let previousEnd = 0
  while ((match = linkPattern.exec(md)) !== null) {
    let block = md.slice(previousEnd, match.index)
    previousEnd = linkPattern.lastIndex
    const id = match[1]
    const anchor = authorAnchor ? block.lastIndexOf(authorAnchor) : -1
    if (anchor !== -1) block = block.slice(anchor)

    let replyTo = ''
    let replyToId = ''
    const badges = []
    let stats = ''
    const body = []
    for (const rawLine of block.split('\n')) {
      const line = rawLine.trim()
      if (!line) continue
      if (line.startsWith('#')) continue
      const timeMatch = line.match(/\b(\d{2}):(\d{2})\s+UTC(.*)$/)
      if (timeMatch && !badges.length && !body.length && !replyTo) {
        const badge = timeMatch[3].trim()
        if (badge) badges.push(badge)
        continue
      }
      const replyMatch = line.match(/Replying to \[@([A-Za-z0-9_]+)\]\((https?:\/\/x\.com\/[^)]*?\/status\/(\d+))\)/)
      if (replyMatch && !replyTo) {
        replyTo = replyMatch[1]
        replyToId = replyMatch[3]
        continue
      }
      if (/^[\d,]+\s+repl(?:y|ies)\b/.test(line) && line.length < 90 && !stats) {
        stats = line
        continue
      }
      if (authorAnchor && line.startsWith(authorAnchor)) continue
      if (line.startsWith('Replying to')) continue
      body.push(line)
    }

    let text = cleanText(body.join(' '))
    if (replyTo) text = text.replace(/^(?:@[A-Za-z0-9_]+\s*)+/, '').trim()

    if (seen.has(id)) continue
    seen.add(id)
    const date = idToDate(id)
    items.push({
      id,
      account: account.id,
      label: account.label || account.handle || '',
      ts: date ? date.toISOString() : null,
      bj: beijingLabel(date),
      isReply: Boolean(replyTo),
      replyTo,
      replyToId,
      hot: HOT_PATTERN.test(`${text} ${badges.join(' ')}`),
      text: text || '（这条只有图片或视频，没有文字）',
      stats,
    })
  }
  items.sort((a, b) => (a.id > b.id ? -1 : a.id < b.id ? 1 : 0))
  return items
}

/** Accept `{ posts: [...] }`, `{ items: [...] }` or a bare array. */
function parseJsonFeed(data, account) {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.posts)
      ? data.posts
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
          ? data.data
          : []
  const items = []
  const seen = new Set()
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const id = String(raw.id ?? raw.tweet_id ?? raw.url ?? '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const date = raw.createdAt || raw.created_at || raw.date ? new Date(raw.createdAt || raw.created_at || raw.date) : idToDate(id)
    const text = cleanText(raw.text ?? raw.content ?? '')
    const replyTo = String(raw.replyTo ?? raw.reply_to ?? '').replace(/^@/, '')
    items.push({
      id,
      account: account.id,
      label: account.label || account.handle || '',
      ts: date && Number.isFinite(date.getTime()) ? date.toISOString() : null,
      bj: beijingLabel(date && Number.isFinite(date.getTime()) ? date : null),
      isReply: Boolean(replyTo || raw.isReply || raw.is_reply),
      replyTo,
      replyToId: String(raw.replyToId ?? raw.reply_to_id ?? ''),
      hot: HOT_PATTERN.test(text),
      text: text || '（这条没有文字）',
      stats: typeof raw.stats === 'string' ? raw.stats : '',
    })
  }
  items.sort((a, b) => (a.id > b.id ? -1 : a.id < b.id ? 1 : 0))
  return items
}

async function fetchTiboreset(account) {
  const response = await fetch(account.sourceUrl, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/markdown, text/plain;q=0.8' },
    signal: AbortSignal.timeout(25000),
  })
  if (!response.ok) throw new Error(`source ${response.status}`)
  const markdown = await response.text()
  const items = parseTiboresetMarkdown(markdown, account)
  if (items.length < 5) throw new Error(`parse produced ${items.length} items`)
  return items
}

async function fetchJsonSource(account) {
  const response = await fetch(account.sourceUrl, {
    headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    signal: AbortSignal.timeout(25000),
  })
  if (!response.ok) throw new Error(`source ${response.status}`)
  const data = await response.json()
  const items = parseJsonFeed(data, account)
  if (items.length === 0) throw new Error('json source produced no items')
  return items
}

function fetchAccount(account) {
  if (account.sourceType === 'json') return fetchJsonSource(account)
  return fetchTiboreset(account)
}

async function fetchQuoted(id) {
  if (!id) return null
  try {
    const response = await fetch(FX_API + id, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) return null
    const data = await response.json()
    const tweet = data?.tweet
    if (!tweet) return null
    const text = cleanText(tweet.text)
    if (!text) return null
    return {
      id,
      name: tweet.author?.name || '',
      handle: tweet.author?.screen_name || '',
      text,
    }
  } catch (error) {
    return null
  }
}

export function apply(ctx) {
  const state = {
    items: [],
    cursors: {},
    updatedAt: null,
    lastPollAt: null,
    lastError: null,
    translates: 0,
  }
  let loading = null
  let config = { ...DEFAULT_CONFIG }
  let translatorUnavailable = false

  const snapshot = () => ({
    updatedAt: state.updatedAt,
    lastPollAt: state.lastPollAt,
    lastError: state.lastError,
    intervalMs: Math.max(1, Number(config.pollMinutes) || 3) * 60 * 1000,
    meta: {
      cardTop: Number(config.cardTop) || 74,
      translate: Boolean(config.translate),
      accounts: (config.accounts || []).filter((a) => a?.enabled).map((a) => a.label || a.handle || a.id),
    },
    items: state.items,
  })

  async function loadConfig() {
    try {
      const raw = await readFile(CONFIG_FILE, 'utf8')
      const parsed = JSON.parse(raw)
      config = { ...DEFAULT_CONFIG, ...parsed }
      if (!Array.isArray(config.accounts) || config.accounts.length === 0) config.accounts = DEFAULT_CONFIG.accounts
    } catch (error) {
      if (error?.code !== 'ENOENT') ctx.logger?.warn?.('tibo-reset-watch: config unreadable, using defaults: %s', error)
      config = { ...DEFAULT_CONFIG }
      try {
        await mkdir(STATE_DIR, { recursive: true })
        await writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8')
      } catch (writeError) {
        ctx.logger?.warn?.('tibo-reset-watch: config write failed: %s', writeError)
      }
    }
  }

  async function persist() {
    try {
      await mkdir(STATE_DIR, { recursive: true })
      await writeFile(
        STATE_FILE,
        JSON.stringify({ cursors: state.cursors, updatedAt: state.updatedAt, items: state.items }, null, 2),
        'utf8',
      )
    } catch (error) {
      ctx.logger?.warn?.('tibo-reset-watch: persist failed: %o', error)
    }
  }

  async function restore() {
    try {
      const raw = await readFile(STATE_FILE, 'utf8')
      const saved = JSON.parse(raw)
      if (Array.isArray(saved?.items)) state.items = saved.items
      if (saved?.cursors && typeof saved.cursors === 'object') state.cursors = saved.cursors
      if (typeof saved?.updatedAt === 'string') state.updatedAt = saved.updatedAt
    } catch (error) {
      if (error?.code !== 'ENOENT') ctx.logger?.warn?.('tibo-reset-watch: restore failed: %o', error)
    }
  }

  /** Host translation service: anonymous routes first, no key required. */
  async function translateToChinese(text) {
    if (!text || !config.translate || translatorUnavailable) return null
    const translator = typeof ctx.get === 'function' ? ctx.get('translator') : undefined
    if (!translator || typeof translator.resolve !== 'function' || typeof translator.translate !== 'function') {
      translatorUnavailable = true
      ctx.logger?.info?.('tibo-reset-watch: no Host translation service, showing the original text')
      return null
    }
    const clipped = String(text).slice(0, 2000)
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const spec = translator.resolve({
          text: clipped,
          targetLanguage: config.targetLanguage || 'zh-CN',
          sourceLanguage: config.sourceLanguage || 'en',
        })
        const translated = await translator.translate(spec)
        if (typeof translated === 'string' && translated.trim()) return translated.trim()
        return null
      } catch (error) {
        if (attempt === 1) {
          ctx.logger?.warn?.('tibo-reset-watch: translate failed: %s', error?.message || error)
          return null
        }
      }
    }
    return null
  }

  function sortItems() {
    state.items.sort((a, b) => (a.id > b.id ? -1 : a.id < b.id ? 1 : 0))
  }

  async function enrichQuoted(items, budget) {
    let left = budget
    for (const item of items) {
      if (left <= 0) return
      if (item.quoted || !item.replyToId) continue
      const quoted = await fetchQuoted(item.replyToId)
      left -= 1
      if (!quoted) continue
      item.quoted = quoted
      item.quoted.zh = await translateToChinese(quoted.text)
    }
  }

  async function poll() {
    if (loading) return loading
    loading = (async () => {
      const startedAt = new Date()
      const accounts = (config.accounts || []).filter((account) => account?.enabled && account.sourceUrl)
      if (accounts.length === 0) {
        state.lastError = 'no enabled account'
        state.lastPollAt = startedAt.toISOString()
        loading = null
        return
      }
      const collected = []
      const errors = []
      for (const account of accounts) {
        try {
          const items = await fetchAccount(account)
          collected.push(...items)
        } catch (error) {
          errors.push(`${account.label || account.id}: ${error?.message || error}`)
        }
      }
      try {
        if (collected.length === 0) throw new Error(errors.join('; ') || 'all sources failed')

        // Merge and de-duplicate against what is already on screen.
        const known = new Set(state.items.map((item) => item.id))
        const byCursor = new Map()
        const freshByAccount = new Map()
        for (const item of collected) {
          if (!byCursor.has(item.account) || item.id > byCursor.get(item.account)) byCursor.set(item.account, item.id)
          if (!known.has(item.id)) {
            if (!freshByAccount.has(item.account)) freshByAccount.set(item.account, [])
            freshByAccount.get(item.account).push(item)
          }
        }
        const fresh = []
        for (const [accountId, list] of freshByAccount) {
          const previous = state.cursors[accountId]
          const selected = previous ? list.filter((item) => item.id > previous) : list.slice(0, 3)
          fresh.push(...selected)
        }
        fresh.sort((a, b) => (a.id > b.id ? -1 : a.id < b.id ? 1 : 0))

        for (const item of fresh.slice(0, MAX_TRANSLATE_PER_ROUND)) {
          item.zh = await translateToChinese(item.text)
          if (item.zh) state.translates += 1
        }
        if (fresh.length > 0) state.items = [...fresh.reverse(), ...state.items]

        const deduped = []
        const seen = new Set()
        for (const item of state.items) {
          if (seen.has(item.id)) continue
          seen.add(item.id)
          deduped.push(item)
        }
        state.items = deduped.slice(0, Math.max(5, Number(config.keep) || 40))
        sortItems()

        await enrichQuoted(state.items.filter((item) => !item.quoted), MAX_QUOTED_PER_ROUND)

        const missing = state.items.filter((item) => !item.zh).slice(0, 1)
        for (const item of missing) {
          item.zh = await translateToChinese(item.text)
          if (item.zh) state.translates += 1
        }

        for (const [accountId, id] of byCursor) state.cursors[accountId] = id
        state.updatedAt = startedAt.toISOString()
        state.lastError = errors.length ? errors.join('; ') : null
        await persist()
      } catch (error) {
        state.lastError = String(error?.message || error)
        ctx.logger?.warn?.('tibo-reset-watch: poll failed: %s', state.lastError)
      } finally {
        state.lastPollAt = new Date().toISOString()
        loading = null
      }
    })()
    return loading
  }

  ctx.logger?.info?.('tibo-reset-watch: applying, webServer=%s', typeof ctx.webServer?.register === 'function' ? 'yes' : 'no')

  ctx.effect(
    () => {
      return ctx.webServer.register({
        kind: 'exact',
        path: FEED_PATH,
        handler: async (request, response) => {
          try {
            const url = new URL(request.url ?? '/', 'http://x')
            if (url.searchParams.get('refresh') === '1') await poll()
            const body = JSON.stringify(snapshot())
            response.writeHead(200, {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'no-store',
            })
            response.end(body)
          } catch (error) {
            ctx.logger?.warn?.('tibo-reset-watch: feed failed: %s', error?.stack || error)
            response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
            response.end(JSON.stringify({ error: String(error?.message || error) }))
          }
        },
      })
    },
    'tibo-reset-watch-feed-route',
  )

  ctx.effect(() => {
    let disposed = false
    let timer
    const arm = () => {
      const minutes = Math.max(1, Number(config.pollMinutes) || 3)
      timer = setInterval(tick, minutes * 60 * 1000)
    }
    const tick = () => {
      if (disposed) return
      void poll()
    }
    void loadConfig().then(() => {
      if (disposed) return
      void restore().then(tick)
      arm()
    })
    return () => {
      disposed = true
      if (timer) clearInterval(timer)
    }
  }, 'tibo-reset-watch-poller')
}
