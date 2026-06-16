import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAuctions } from '../../api/user'
import type { UserAuctionListItem } from '../../api/user'
import { formatCents } from '../../utils/money'

export function HistoryPage() {
  const [items, setItems] = useState<UserAuctionListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    listAuctions({ status: 'settled', page: 1, pageSize: 50 })
      .then((res) => {
        if (!cancelled) setItems(res.items)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="user-page">
      <header className="user-page__head">
        <h1>历史竞拍</h1>
        <p className="page-desc">已成交场次记录</p>
      </header>

      {loading && <p className="user-hint">加载中…</p>}

      <ul className="auction-card-list auction-card-list--compact">
        {items.map(({ session, product }) => (
          <li key={session.id}>
            <Link
              to={`/app/result/${session.id}`}
              className="auction-card auction-card--row"
            >
              <img src={product.coverUrl} alt="" className="auction-card__img" />
              <div className="auction-card__body">
                <h2>{product.name}</h2>
                <p className="price-sm">成交价 {formatCents(session.currentPrice)}</p>
                {session.settledAt && (
                  <span className="muted">
                    {new Date(session.settledAt).toLocaleString('zh-CN')}
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {!loading && items.length === 0 && (
        <p className="user-hint">暂无历史记录</p>
      )}
    </div>
  )
}
