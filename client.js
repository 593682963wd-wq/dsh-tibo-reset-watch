/**
 * Client half of Tibo Reset Watch.
 *
 * Top-right HUD: a round badge on the window edge when idle, a glass card when
 * there is news. Every row shows what the account said; clicking a row reveals
 * the post it replied to. Hovering or clicking a row marks it read.
 */
window.__ModuleLoader__.load({
  id: 'dsh-tibo-reset-watch',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const FEED_URL = '/tibo-reset-watch/feed';
    const READ_KEY = 'dsh-tibo-reset-watch-read-ids';
    const VISIBLE_ITEMS = 8;
    const AUTO_COLLAPSE_MS = 16000;
    const CLIENT_POLL_MS = 25000;
    const AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMwYjE1MjQiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMxMDJhM2QiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHJ4PSIxNiIgZmlsbD0idXJsKCNnKSIvPjxwYXRoIGQ9Ik0xNiAxN2gxMC41bDggMTEuNkw0MyAxN2g1TDM1LjUgMzIuNiA0OCA0N0gzNy40bC04LjYtMTIuNUwxOS42IDQ3SDE0bDEyLjMtMTYuNHoiIGZpbGw9IiM0ZGUzZmYiLz48Y2lyY2xlIGN4PSI0OC41IiBjeT0iMTUuNSIgcj0iNiIgZmlsbD0iI2ZmM2I0ZCIvPjwvc3ZnPg==';

    const CSS = [
      /* ---------- frame ---------- */
      '.tw-root{position:fixed;top:var(--xw-top,74px);right:0;z-index:60;display:flex;justify-content:flex-end;',
      'pointer-events:auto;font:13px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;',
      '--tw-cyan:#4de3ff;--tw-alert:#ff5d73;--tw-ink:#e9f6ff;--tw-dim:#8ea6bb;',
      '--tw-line:rgba(77,227,255,.22);}',

      /* ---------- collapsed avatar ---------- */
      '.tw-tab{position:relative;width:46px;height:46px;margin-right:12px;padding:0;cursor:pointer;',
      'border-radius:14px;border:1px solid var(--tw-line);background:rgba(10,17,27,.9);',
      'box-shadow:0 10px 26px -12px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,255,255,.06);',
      'transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease;}',
      '.tw-tab:hover{transform:translateY(-1px);border-color:rgba(77,227,255,.45);',
      'box-shadow:0 14px 30px -12px rgba(77,227,255,.35),inset 0 1px 0 rgba(255,255,255,.1);}',
      '.tw-tab:active{transform:translateY(0) scale(.98);}',
      '.tw-tab--alert{border-color:rgba(77,227,255,.38);',
      'box-shadow:0 12px 30px -12px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,255,255,.08);}',
      '.tw-tab__img{position:absolute;inset:4px;width:36px;height:36px;border-radius:10px;object-fit:cover;',
      'display:block;filter:saturate(1.05);}',
      '.tw-tab__ring{position:absolute;inset:-1px;border-radius:14px;pointer-events:none;',
      'box-shadow:inset 0 0 0 1px rgba(77,227,255,.25);}',
      '.tw-tab--alert .tw-tab__ring{box-shadow:inset 0 0 0 1px rgba(77,227,255,.3);}',
      '.tw-tab__dot{position:absolute;top:-1px;right:-1px;width:11px;height:11px;border-radius:50%;',
      'background:#ff3b4d;box-shadow:0 0 0 2.5px rgba(10,17,27,.95),0 0 10px rgba(255,59,77,.7);',
      'animation:tw-pop .18s ease-out;}',
      '@keyframes tw-pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}',


      /* ---------- card ---------- */
      '.tw-card{position:relative;width:372px;max-height:min(66vh,560px);margin-right:12px;',
      'display:flex;flex-direction:column;border-radius:14px;overflow:hidden;',
      'background:linear-gradient(158deg,rgba(17,28,43,.94),rgba(8,13,21,.96));',
      'border:1px solid var(--tw-line);backdrop-filter:blur(16px) saturate(1.25);',
      'box-shadow:0 24px 60px -22px rgba(0,0,0,.85),0 0 0 1px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.06);',
      'animation:tw-drop .2s cubic-bezier(.2,.8,.3,1);}',
      '@keyframes tw-drop{from{opacity:0;transform:translateY(-8px) scale(.985)}to{opacity:1;transform:none}}',
      '.tw-card::before{content:"";position:absolute;inset:0 0 auto 0;height:1px;',
      'background:linear-gradient(90deg,transparent,rgba(77,227,255,.85),rgba(139,147,255,.35),transparent);}',
      '.tw-card::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.45;',
      'background-image:linear-gradient(rgba(77,227,255,.045) 1px,transparent 1px);background-size:100% 22px;}',
      '.tw-corner{position:absolute;width:9px;height:9px;border-color:rgba(77,227,255,.6);pointer-events:none;z-index:2;}',
      '.tw-corner--tl{top:5px;left:5px;border-top:1px solid;border-left:1px solid;border-radius:2px 0 0 0;}',
      '.tw-corner--br{bottom:5px;right:5px;border-bottom:1px solid;border-right:1px solid;border-radius:0 0 2px 0;}',

      /* ---------- header ---------- */
      '.tw-head{position:relative;display:flex;align-items:center;gap:8px;padding:6px 8px 6px 12px;z-index:1;',
      'cursor:pointer;border-radius:13px 13px 0 0;transition:background .12s ease;}',
      '.tw-head:hover{background:rgba(77,227,255,.06);}',
      '.tw-ava{width:22px;height:22px;border-radius:7px;object-fit:cover;display:block;',
      'box-shadow:0 0 0 1px rgba(77,227,255,.35);}',
      '.tw-title{font-size:12.5px;font-weight:700;letter-spacing:.6px;color:var(--tw-ink);}',
      '.tw-title em{font-style:normal;font-weight:500;color:rgba(77,227,255,.75);letter-spacing:.4px;}',
      '.tw-sync{margin-left:auto;font:10.5px/1 ui-monospace,SFMono-Regular,Menlo,monospace;',
      'color:var(--tw-dim);letter-spacing:.3px;}',
      '.tw-x{border:0;background:transparent;color:rgba(142,166,187,.85);cursor:pointer;',
      'font-size:19px;line-height:1;width:28px;height:28px;display:flex;align-items:center;justify-content:center;',
      'border-radius:8px;transition:background .12s ease,color .12s ease;}',
      '.tw-x:hover{color:var(--tw-ink);background:rgba(77,227,255,.14);}',
      '.tw-rule{height:1px;margin:0 12px;background:linear-gradient(90deg,var(--tw-line),rgba(77,227,255,.03));}',

      /* ---------- list ---------- */
      '.tw-list{position:relative;overflow:auto;padding:8px 8px 10px;z-index:1;}',
      '.tw-item{position:relative;margin:2px 4px;padding:8px 10px 8px 12px;border-radius:9px;cursor:pointer;',
      'border:1px solid transparent;transition:background .12s ease,border-color .12s ease;}',
      '.tw-item::before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:2px;border-radius:2px;',
      'background:rgba(77,227,255,.18);}',
      '.tw-item:hover{background:rgba(77,227,255,.06);border-color:rgba(77,227,255,.16);}',
      '.tw-item--unread{border-color:rgba(77,227,255,.3);',
      'background:linear-gradient(90deg,rgba(77,227,255,.1),rgba(77,227,255,.02));}',
      '.tw-item--unread::before{background:var(--tw-cyan);box-shadow:0 0 8px rgba(77,227,255,.8);}',
      '.tw-item--read{opacity:.72;}',
      '.tw-item--read:hover{opacity:1;}',
      '.tw-meta{display:flex;align-items:center;gap:6px;margin-bottom:4px;',
      'font:10px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--tw-dim);letter-spacing:.2px;}',
      '.tw-meta .tw-hot{color:#ffcf70;}',
      '.tw-meta .tw-more{margin-left:auto;padding:2px 6px;border-radius:5px;cursor:pointer;',
      'border:1px solid rgba(77,227,255,.2);background:rgba(77,227,255,.07);',
      'color:rgba(77,227,255,.75);font:9.5px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.4px;}',
      '.tw-meta .tw-more:hover{background:rgba(77,227,255,.16);color:#dff7ff;}',
      '.tw-zh{font-size:13px;line-height:1.55;color:var(--tw-ink);word-break:break-word;}',
      '.tw-en{margin-top:4px;font-size:10.5px;line-height:1.45;color:rgba(142,166,187,.78);',
      'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '.tw-empty{padding:28px 12px;text-align:center;color:var(--tw-dim);font-size:12px;letter-spacing:.3px;}',

      /* ---------- quoted post ---------- */
      '.tw-quote{margin-top:8px;padding:8px 10px;border-radius:8px;',
      'background:rgba(77,227,255,.055);border:1px solid rgba(77,227,255,.16);',
      'animation:tw-quote .16s ease-out;}',
      '@keyframes tw-quote{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}',
      '.tw-quote__head{display:flex;align-items:center;gap:6px;margin-bottom:4px;',
      'font:9.5px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:rgba(77,227,255,.75);letter-spacing:.3px;}',
      '.tw-quote__head b{font-weight:500;color:rgba(142,166,187,.9);}',
      '.tw-quote__zh{font-size:12px;line-height:1.55;color:rgba(233,246,255,.92);}',
      '.tw-quote__en{margin-top:3px;font-size:10px;line-height:1.45;color:rgba(142,166,187,.65);',
      'display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}',
      '.tw-quote__miss{font-size:11px;color:rgba(142,166,187,.7);}',

      /* ---------- footer ---------- */
      '.tw-foot{position:relative;display:flex;align-items:center;gap:8px;padding:7px 12px 8px;z-index:1;',
      'border-top:1px solid rgba(77,227,255,.12);',
      'font:9.5px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:rgba(142,166,187,.8);letter-spacing:.5px;}',
      '.tw-foot b{font-weight:500;color:rgba(77,227,255,.8);}',
      '.tw-foot .tw-push{margin-left:auto;color:rgba(142,166,187,.6);}',

      '@media (prefers-reduced-motion:reduce){.tw-card,.tw-quote{animation:none!important}}',
    ].join('');

    function loadReadIds() {
      try {
        const raw = window.localStorage.getItem(READ_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    }

    function saveReadIds(ids) {
      try {
        window.localStorage.setItem(READ_KEY, JSON.stringify(ids.slice(-300)));
      } catch (error) {
        /* private mode: read state stays in memory */
      }
    }

    function clockOf(iso) {
      if (!iso) return '--:--';
      try {
        return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      } catch (error) {
        return '--:--';
      }
    }

    function sortNewestFirst(list) {
      return list.slice().sort(function (a, b) {
        try {
          return BigInt(b.id) > BigInt(a.id) ? 1 : BigInt(b.id) < BigInt(a.id) ? -1 : 0;
        } catch (error) {
          return 0;
        }
      });
    }

    function TiboWidget() {
      const [feed, setFeed] = React.useState(null);
      const [open, setOpen] = React.useState(false);
      const [readIds, setReadIds] = React.useState(loadReadIds);
      const [expandedId, setExpandedId] = React.useState(null);
      const [failed, setFailed] = React.useState(false);

      const newestRef = React.useRef(null);
      const collapseRef = React.useRef(null);
      const hoverRef = React.useRef(false);
      const readRef = React.useRef(readIds);
      readRef.current = readIds;

      const items = React.useMemo(function () {
        const list = feed && Array.isArray(feed.items) ? feed.items : [];
        return sortNewestFirst(list);
      }, [feed]);

      const readSet = React.useMemo(function () {
        return new Set(readIds);
      }, [readIds]);

      const unread = React.useMemo(function () {
        return items.filter(function (item) {
          return !readSet.has(item.id);
        });
      }, [items, readSet]);

      const newestId = items.length ? items[0].id : null;

      const markRead = React.useCallback(function (id) {
        if (!id) return;
        const current = readRef.current;
        if (current.indexOf(id) !== -1) return;
        const next = current.concat(id);
        readRef.current = next;
        setReadIds(next);
        saveReadIds(next);
      }, []);

      React.useEffect(function () {
        let alive = true;
        const load = function (force) {
          const url = force ? FEED_URL + '?refresh=1' : FEED_URL;
          fetch(url, { headers: { accept: 'application/json' } })
            .then(function (response) {
              if (!response.ok) throw new Error('bad status');
              return response.json();
            })
            .then(function (data) {
              if (!alive) return;
              setFeed(data);
              setFailed(false);
            })
            .catch(function () {
              if (!alive) return;
              setFailed(true);
            });
        };
        load(true);
        const timer = setInterval(function () {
          load(false);
        }, CLIENT_POLL_MS);
        return function () {
          alive = false;
          clearInterval(timer);
        };
      }, []);

      // New content pops the card open, then folds back to the avatar.
      React.useEffect(function () {
        if (!newestId) return;
        if (newestRef.current === newestId) return;
        const first = newestRef.current === null;
        newestRef.current = newestId;
        if (first && unread.length === 0) return;
        setOpen(true);
        if (collapseRef.current) clearTimeout(collapseRef.current);
        collapseRef.current = setTimeout(function () {
          if (!hoverRef.current) setOpen(false);
        }, AUTO_COLLAPSE_MS);
        return function () {
          if (collapseRef.current) clearTimeout(collapseRef.current);
        };
      }, [newestId, unread.length]);


      React.useEffect(function () {
        return function () {
          if (collapseRef.current) clearTimeout(collapseRef.current);
        };
      }, []);

      if (!feed && failed) return null;

      const cardTop = feed && feed.meta && Number(feed.meta.cardTop) ? Number(feed.meta.cardTop) : 74;
      const title = (feed && feed.meta && feed.meta.title) || 'Tibo 重置监控';
      const pollLabel = feed && feed.intervalMs ? Math.max(1, Math.round(feed.intervalMs / 60000)) + 'M' : '3M';

      const count = unread.length;
      const syncText = feed && feed.updatedAt ? clockOf(feed.updatedAt) : failed ? 'OFFLINE' : 'SYNC';

      if (!open) {
        const label = count > 0 ? 'Tibo 重置监控 · ' + count + ' 条新动态' : 'Tibo 重置监控';
        return h(
          React.Fragment,
          null,
          h('style', { children: CSS }),
          h(
            'div',
            { className: 'tw-root', style: { '--xw-top': cardTop + 'px' } },
            h(
              'button',
              {
                type: 'button',
                className: 'tw-tab' + (count > 0 ? ' tw-tab--alert' : ''),
                title: label,
                'aria-label': label,
                onClick: function () {
                  setOpen(true);
                },
              },
              h('img', { className: 'tw-tab__img', src: AVATAR, alt: '', draggable: false }),
              h('span', { className: 'tw-tab__ring', 'aria-hidden': 'true' }),
              count > 0
                ? h('span', { className: 'tw-tab__dot', 'aria-hidden': 'true' })
                : null,
            ),
          ),
        );
      }

      const shown = items.slice(0, VISIBLE_ITEMS);
      const hasTranslation = items.some(function (item) {
        return Boolean(item.zh);
      });

      return h(
        React.Fragment,
        null,
        h('style', { children: CSS }),
        h(
          'div',
          { className: 'tw-root', style: { '--xw-top': cardTop + 'px' } },
          h(
            'section',
            {
              className: 'tw-card',
              role: 'dialog',
              'aria-label': 'Tibo 重置监控 动态',
              onMouseEnter: function () {
                hoverRef.current = true;
                if (collapseRef.current) {
                  clearTimeout(collapseRef.current);
                  collapseRef.current = null;
                }
              },
              onMouseLeave: function () {
                hoverRef.current = false;
              },
            },
            h('span', { className: 'tw-corner tw-corner--tl', 'aria-hidden': 'true' }),
            h('span', { className: 'tw-corner tw-corner--br', 'aria-hidden': 'true' }),
            h(
              'header',
              {
                className: 'tw-head',
                title: '点击收起',
                onClick: function () {
                  setOpen(false);
                  setExpandedId(null);
                },
              },
              h('img', { className: 'tw-ava', src: AVATAR, alt: '', draggable: false }),
              h('span', { className: 'tw-title' }, title, ' ', h('em', null, '// LIVE')),
              h('span', { className: 'tw-sync' }, syncText),
              h(
                'button',
                {
                  type: 'button',
                  className: 'tw-x',
                  'aria-label': '收起',
                  onClick: function (event) {
                    event.stopPropagation();
                    setOpen(false);
                    setExpandedId(null);
                  },
                },
                '×',
              ),
            ),
            h('div', { className: 'tw-rule', 'aria-hidden': 'true' }),
            h(
              'div',
              { className: 'tw-list' },
              shown.length === 0
                ? h('div', { className: 'tw-empty' }, failed ? '连接中断，稍后重试' : '暂无新动态')
                : shown.map(function (item) {
                    const isUnread = !readSet.has(item.id);
                    const expanded = expandedId === item.id;
                    const canOpen = item.isReply;
                    return h(
                      'div',
                      {
                        key: item.id,
                        className:
                          'tw-item' +
                          (isUnread ? ' tw-item--unread' : ' tw-item--read'),
                        onMouseEnter: function () {
                          markRead(item.id);
                        },
                        onClick: function () {
                          markRead(item.id);
                          setExpandedId(expanded ? null : item.id);
                        },
                      },
                      h(
                        'div',
                        { className: 'tw-meta' },
                        h('span', null, item.bj || ''),
                        h('span', null, item.isReply ? 'REPLY @' + item.replyTo : 'POST'),
                        item.hot ? h('span', { className: 'tw-hot' }, '◆ RESET') : null,
                        canOpen
                          ? h(
                              'button',
                              {
                                type: 'button',
                                className: 'tw-more',
                                'aria-expanded': expanded,
                                onClick: function (event) {
                                  event.stopPropagation();
                                  markRead(item.id);
                                  setExpandedId(expanded ? null : item.id);
                                },
                              },
                              expanded ? '收起原帖 ▲' : '看原帖 ▾',
                            )
                          : null,
                      ),
                      h('div', { className: 'tw-zh' }, item.zh || item.text),
                      item.zh && item.text && item.zh !== item.text
                        ? h('div', { className: 'tw-en' }, item.text)
                        : null,
                      expanded
                        ? h(
                            'div',
                            {
                              className: 'tw-quote',
                              onClick: function (event) {
                                event.stopPropagation();
                              },
                            },
                            h(
                              'div',
                              { className: 'tw-quote__head' },
                              '↳ 被回复的原帖',
                              item.quoted && item.quoted.handle
                                ? h('b', null, '@' + item.quoted.handle)
                                : null,
                              item.quoted && item.quoted.name
                                ? h('span', null, '· ' + item.quoted.name)
                                : null,
                            ),
                            item.quoted
                              ? h(
                                  React.Fragment,
                                  null,
                                  h('div', { className: 'tw-quote__zh' }, item.quoted.zh || item.quoted.text),
                                  item.quoted.zh && item.quoted.text
                                    ? h('div', { className: 'tw-quote__en' }, item.quoted.text)
                                    : null,
                                )
                              : h('div', { className: 'tw-quote__miss' }, '原帖还没取到，下一轮补上（可能已被删除）'),
                          )
                        : null,
                    );
                  }),
            ),
            h(
              'footer',
              { className: 'tw-foot' },
              h('b', null, 'POLL ' + pollLabel),
              h('span', null, '·'),
              h('span', null, hasTranslation ? 'TRANSLATED' : 'ORIGINAL'),
              h('span', { className: 'tw-push' }, '滑过或点开即已读'),
            ),
          ),
        ),
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('shell.overlay', function () {
          return ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'tibo-reset-watch',
              order: 200,
            },
            TiboWidget,
          );
        });
      },
    };
  },
});
