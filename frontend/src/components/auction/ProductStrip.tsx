import type { SessionSummary } from '../../api/types'

type Props = {
  items: SessionSummary[]
  currentSessionId?: number
  onSelect: (sessionId: number) => void
}

export function ProductStrip({ items, currentSessionId, onSelect }: Props) {
  if (items.length === 0) return null
  return (
    <div className="product-strip" role="list" aria-label="直播间商品">
      {items.map((item) => {
        const active = item.sessionId === currentSessionId
        return (
          <button
            key={item.sessionId}
            type="button"
            role="listitem"
            className={`product-strip__item${active ? ' product-strip__item--active' : ''}`}
            onClick={() => onSelect(item.sessionId)}
            aria-pressed={active}
          >
            {item.coverUrl ? (
              <img src={item.coverUrl} alt="" className="product-strip__thumb" />
            ) : (
              <span className="product-strip__thumb product-strip__thumb--placeholder" />
            )}
            <span className="product-strip__name">{item.name}</span>
          </button>
        )
      })}
    </div>
  )
}
