import { apiRequest } from './client'
import type {
  AuctionSession,
  Order,
  Paginated,
  ProductBody,
  ProductStatus,
  ProductView,
  PublishAuctionBody,
  OrderStatus,
} from './types'

export function listProducts(params: {
  page?: number
  pageSize?: number
  status?: ProductStatus
}) {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.pageSize) q.set('pageSize', String(params.pageSize))
  if (params.status) q.set('status', params.status)
  const qs = q.toString()
  return apiRequest<Paginated<ProductView>>(
    `/admin/products${qs ? `?${qs}` : ''}`,
  )
}

export function getProduct(id: number) {
  return apiRequest<ProductView>(`/admin/products/${id}`)
}

export function createProduct(body: ProductBody) {
  return apiRequest<ProductView>('/admin/products', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateProduct(id: number, body: ProductBody) {
  return apiRequest<ProductView>(`/admin/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function deleteProduct(id: number) {
  return apiRequest<{ deleted: boolean }>(`/admin/products/${id}`, {
    method: 'DELETE',
  })
}

export function publishAuction(productId: number, body: PublishAuctionBody) {
  return apiRequest<AuctionSession>(`/admin/products/${productId}/auctions`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getAuction(sessionId: number) {
  return apiRequest<AuctionSession>(`/admin/auctions/${sessionId}`)
}

export function updateAuctionRules(
  sessionId: number,
  body: PublishAuctionBody,
) {
  return apiRequest<AuctionSession>(`/admin/auctions/${sessionId}/rules`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function cancelAuction(sessionId: number, reason: string) {
  return apiRequest<AuctionSession>(`/admin/auctions/${sessionId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export function listOrders(params: {
  page?: number
  pageSize?: number
  status?: OrderStatus
}) {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.pageSize) q.set('pageSize', String(params.pageSize))
  if (params.status) q.set('status', params.status)
  const qs = q.toString()
  return apiRequest<Paginated<Order>>(`/admin/orders${qs ? `?${qs}` : ''}`)
}

export function getOrder(id: number) {
  return apiRequest<Order>(`/admin/orders/${id}`)
}

export function listLiveRooms(params?: { page?: number; pageSize?: number }) {
  const q = new URLSearchParams()
  if (params?.page) q.set('page', String(params.page))
  if (params?.pageSize) q.set('pageSize', String(params.pageSize))
  const qs = q.toString()
  return apiRequest<Paginated<import('./types').LiveRoom>>(
    `/admin/live-rooms${qs ? `?${qs}` : ''}`,
  )
}

export function createLiveRoom(body: { title: string; coverUrl?: string }) {
  return apiRequest<import('./types').LiveRoom>('/admin/live-rooms', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getLiveRoom(id: number) {
  return apiRequest<import('./types').LiveRoomDetail>(`/admin/live-rooms/${id}`)
}

export function updateLiveRoom(id: number, body: { title: string; coverUrl?: string }) {
  return apiRequest<import('./types').LiveRoom>(`/admin/live-rooms/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function addLiveRoomItem(
  id: number,
  body: {
    productId: number
    startingPrice: number
    bidIncrement: number
    capPrice?: number | null
    durationSec: number
    extendThresholdSec?: number
    extendSec?: number
  },
) {
  return apiRequest<import('./types').LiveRoomItem>(`/admin/live-rooms/${id}/items`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function removeLiveRoomItem(liveRoomId: number, itemId: number) {
  return apiRequest<{ removed: boolean }>(
    `/admin/live-rooms/${liveRoomId}/items/${itemId}`,
    { method: 'DELETE' },
  )
}

export function startLiveRoom(id: number) {
  return apiRequest<import('./types').LiveRoomDetail>(`/admin/live-rooms/${id}/start`, {
    method: 'POST',
  })
}

export function endLiveRoom(id: number) {
  return apiRequest<import('./types').LiveRoom>(`/admin/live-rooms/${id}/end`, {
    method: 'POST',
  })
}

export function switchLiveRoomSession(liveRoomId: number, sessionId: number) {
  return apiRequest<import('./types').LiveRoomDetail>(
    `/admin/live-rooms/${liveRoomId}/switch/${sessionId}`,
    { method: 'POST' },
  )
}

export function hideRoomComment(commentId: number) {
  return apiRequest<{ hidden: boolean }>(`/admin/comments/${commentId}/hide`, {
    method: 'POST',
  })
}

export function listAdminRoomComments(roomId: string) {
  return apiRequest<{ items: import('./social').RoomComment[] }>(
    `/admin/rooms/${encodeURIComponent(roomId)}/comments`,
  )
}
