import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createLiveRoom, listLiveRooms } from '../../api/admin'
import type { LiveRoom } from '../../api/types'
import { StatusBadge } from '../components/StatusBadge'
import { LIVE_ROOM_STATUS_LABEL } from '../labels'

export function LiveRoomListPage() {
  const [items, setItems] = useState<LiveRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listLiveRooms({ page: 1, pageSize: 50 })
      setItems(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCreate() {
    const title = window.prompt('直播间标题', '我的直播间')
    if (!title?.trim()) return
    setCreating(true)
    try {
      const lr = await createLiveRoom({ title: title.trim() })
      window.location.href = `/admin/live-rooms/${lr.id}`
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '创建失败')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page__head">
        <div>
          <h2>直播间管理</h2>
          <p className="page-desc">创建直播间、上架多个商品，进入工作台开播</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={creating}
          onClick={() => void handleCreate()}
        >
          + 新建直播间
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="muted">加载中…</p>}

      {!loading && items.length === 0 && (
        <div className="empty-state">
          <p>还没有直播间，点击右上角创建第一个</p>
        </div>
      )}

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>直播间</th>
              <th>房间号</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((lr) => (
              <tr key={lr.id}>
                <td>
                  <div className="table-product">
                    {lr.coverUrl && (
                      <img src={lr.coverUrl} alt="" className="table-product__thumb" />
                    )}
                    <span>{lr.title}</span>
                  </div>
                </td>
                <td>
                  <code className="mono">{lr.roomId}</code>
                </td>
                <td>
                  <StatusBadge
                    label={LIVE_ROOM_STATUS_LABEL[lr.status]}
                    tone={lr.status === 'live' ? 'success' : lr.status === 'idle' ? 'warn' : 'muted'}
                  />
                </td>
                <td>
                  <Link to={`/admin/live-rooms/${lr.id}`} className="btn-ghost btn-sm">
                    进入工作台
                  </Link>
                  <a
                    href={`/app/live/${lr.roomId}`}
                    className="btn-ghost btn-sm"
                    target="_blank"
                    rel="noreferrer"
                  >
                    预览观众端
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
