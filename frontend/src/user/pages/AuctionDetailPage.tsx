import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getAuction } from '../../api/user'
import type { UserAuctionDetail } from '../../api/user'
import { AuctionRulesCard } from '../../components/auction/AuctionRulesCard'
import { SESSION_STATUS_LABEL } from '../../admin/labels'
import { auctionEntryPath } from '../../utils/auctionNav'
import { formatCents } from '../../utils/money'

export function AuctionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<UserAuctionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = Number(sessionId)
    if (!Number.isFinite(id)) return
    let cancelled = false
    getAuction(id)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  if (error) {
    return (
      <div className="user-page">
        <p className="user-error">{error}</p>
        <Link to="/app">返回列表</Link>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="user-page">
        <p className="user-hint">加载中…</p>
      </div>
    )
  }

  const { session, product, snapshot } = detail
  const canEnterLive =
    session.status === 'pending' || session.status === 'running'

  return (
    <div className="user-page">
      <Link to="/app" className="back-link">
        ← 返回列表
      </Link>

      <img
        src={product.coverUrl}
        alt=""
        className="detail-hero"
      />

      <h1>{product.name}</h1>
      <p className="page-desc">{product.description}</p>

      <div className="snapshot-strip">
        <div>
          <span className="stat-label">当前价</span>
          <strong className="price-lg">{formatCents(snapshot.currentPrice)}</strong>
        </div>
        <div>
          <span className="stat-label">出价 / 参与</span>
          <strong>
            {snapshot.bidCount} / {snapshot.participantCount}
          </strong>
        </div>
        <div>
          <span className="stat-label">状态</span>
          <strong>{SESSION_STATUS_LABEL[session.status]}</strong>
        </div>
      </div>

      <AuctionRulesCard
        rules={session.rules}
        status={SESSION_STATUS_LABEL[session.status]}
      />

      <div className="user-page__actions">
        {canEnterLive && (
          <button
            type="button"
            className="btn-primary btn-block"
            onClick={() => navigate(auctionEntryPath(session))}
          >
            {session.status === 'running' ? '进入直播间出价' : '进入直播间围观'}
          </button>
        )}
        {session.status === 'settled' && (
          <button
            type="button"
            className="btn-primary btn-block"
            onClick={() => navigate(`/app/result/${session.id}`)}
          >
            查看成交结果
          </button>
        )}
      </div>
    </div>
  )
}
