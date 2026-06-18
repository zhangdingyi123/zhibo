import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAuctions } from '../../api/user'
import { listLiveRooms } from '../../api/social'
import type { LiveRoom } from '../../api/types'
import type { UserAuctionListItem } from '../../api/user'
import type { SessionStatus } from '../../api/types'
import { SESSION_STATUS_LABEL, LIVE_ROOM_STATUS_LABEL } from '../../admin/labels'
import { auctionEntryCta, auctionEntryPath } from '../../utils/auctionNav'
import { useCountdown } from '../../hooks/useCountdown'
import { formatCents } from '../../utils/money'
import { formatRemainingMs } from '../../utils/time'

const TABS = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待开始' },
  { key: 'running', label: '进行中' },
] as const

function RunningCountdown({ endAt }: { endAt?: string }) {
  const remainingMs = useCountdown(endAt, Boolean(endAt))
  if (remainingMs == null) return null
  const urgent = remainingMs > 0 && remainingMs <= 60_000
  return (
    <span className={`auction-card__countdown${urgent ? ' auction-card__countdown--urgent' : ''}`}>
      剩余 {formatRemainingMs(remainingMs)}
    </span>
  )
}

export function AuctionListPage() {
  const [status, setStatus] = useState<SessionStatus | ''>('')
  const [items, setItems] = useState<UserAuctionListItem[]>([])
  const [liveRooms, setLiveRooms] = useState<LiveRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.allSettled([
      listAuctions({
        status: status === '' ? undefined : status,
        page: 1,
        pageSize: 30,
      }),
      listLiveRooms({ page: 1, pageSize: 10 }),
    ])
      .then(([auctionResult, liveResult]) => {
        if (cancelled) return
        if (auctionResult.status === 'fulfilled') {
          setItems(auctionResult.value.items ?? [])
        }
        if (liveResult.status === 'fulfilled') {
          setLiveRooms(liveResult.value.items ?? [])
        }
        const failed =
          auctionResult.status === 'rejected'
            ? auctionResult.reason
            : liveResult.status === 'rejected'
              ? liveResult.reason
              : null
        if (failed) {
          setError(failed instanceof Error ? failed.message : '加载失败')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [status])

  useEffect(() => {
    const cancel = load()
    return cancel
  }, [load])

  return (
    <div className="user-page user-page--home">
      <header className="page-hero">
        <div className="page-hero__content">
          <span className="page-hero__badge">实时直播竞拍</span>
          <h1 className="page-hero__title">发现好物</h1>
          <p className="page-hero__sub">进入直播间，参与出价抢拍心仪商品</p>
        </div>
        <button
          type="button"
          className="btn-icon"
          disabled={loading}
          onClick={() => load()}
          aria-label="刷新列表"
          title="刷新"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M21 12a9 9 0 11-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
      </header>

      <div className="tab-row tab-row--pills">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={status === t.key ? 'tab active' : 'tab'}
            onClick={() => setStatus(t.key as SessionStatus | '')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {liveRooms.length > 0 && (
        <section className="live-room-carousel" style={{ marginBottom: '1rem' }}>
          <h2 className="section-title" style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>
            直播间
          </h2>
          <ul className="auction-card-list">
            {liveRooms.map((lr) => (
              <li key={lr.id}>
                <Link
                  to={`/app/live/${lr.roomId}`}
                  className={`auction-card${lr.status === 'live' ? ' auction-card--live' : ''}`}
                >
                  <div className="auction-card__media">
                    {lr.coverUrl ? (
                      <img src={lr.coverUrl} alt="" className="auction-card__img" />
                    ) : (
                      <div className="auction-card__img" style={{ background: 'var(--surface-2)' }} />
                    )}
                    {lr.status === 'live' && (
                      <span className="live-dot" aria-label="直播中">
                        LIVE
                      </span>
                    )}
                  </div>
                  <div className="auction-card__body">
                    <h2>{lr.title}</h2>
                    <div className="auction-card__meta">
                      <span className={`badge badge--${lr.status === 'live' ? 'running' : 'pending'}`}>
                        {LIVE_ROOM_STATUS_LABEL[lr.status]}
                      </span>
                    </div>
                    <span className="auction-card__cta">
                      {lr.status === 'live' ? '进入直播间' : '去看看'}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <div className="inline-alert inline-alert--error">
          <p>{error}</p>
          <button type="button" className="btn-ghost btn-sm" onClick={() => load()}>
            重试
          </button>
        </div>
      )}

      {loading && items.length === 0 && (
        <ul className="auction-card-list" aria-busy="true">
          {[1, 2, 3].map((n) => (
            <li key={n} className="auction-card auction-card--skeleton" />
          ))}
        </ul>
      )}

      <ul className="auction-card-list">
        {items.map(({ session, product }) => (
          <li key={session.id}>
            <Link
              to={auctionEntryPath(session)}
              className={`auction-card${session.status === 'running' ? ' auction-card--live' : ''}`}
            >
              <div className="auction-card__media">
                <img src={product.coverUrl} alt="" className="auction-card__img" />
                {session.status === 'running' && (
                  <span className="live-dot" aria-label="进行中">
                    LIVE
                  </span>
                )}
              </div>
              <div className="auction-card__body">
                <h2>{product.name}</h2>
                <p className="auction-card__desc">{product.description}</p>
                <div className="auction-card__meta">
                  <span className={`badge badge--${session.status}`}>
                    {SESSION_STATUS_LABEL[session.status]}
                  </span>
                  {session.status === 'running' && (
                    <RunningCountdown endAt={session.endAt} />
                  )}
                  <span className="price-sm">
                    {formatCents(session.currentPrice)}
                  </span>
                </div>
                <span className="auction-card__cta">
                  {auctionEntryCta(session.status)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {!loading && items.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-state__icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M7 9h10M7 13h6" />
            </svg>
          </div>
          <p className="empty-state__title">暂无竞拍场次</p>
          <p className="empty-state__desc">稍后再来看看，或切换上方筛选</p>
        </div>
      )}
    </div>
  )
}
