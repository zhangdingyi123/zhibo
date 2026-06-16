export type ProductStatus =
  | 'draft'
  | 'listed'
  | 'auctioning'
  | 'sold'
  | 'off_shelf'

export type SessionStatus =
  | 'pending'
  | 'running'
  | 'settled'
  | 'cancelled'
  | 'failed'

export type OrderStatus = 'pending_pay' | 'paid' | 'cancelled' | 'closed'

export interface AuctionRules {
  startingPrice: number
  bidIncrement: number
  capPrice?: number | null
  durationSec: number
  extendThresholdSec: number
  extendSec: number
}

export interface Product {
  id: number
  anchorId: number
  name: string
  description: string
  coverUrl: string
  images?: string[]
  status: ProductStatus
  createdAt: string
  updatedAt: string
}

export interface AuctionProgress {
  sessionId: number
  roomId: string
  status: SessionStatus
  currentPrice: number
  bidCount: number
  participantCount: number
  scheduledStartAt?: string
  startedAt?: string
  endAt?: string
  settledAt?: string
  winnerId?: number
  cancelReason?: string
  order?: Order
}

export interface ProductView extends Product {
  auction?: AuctionProgress
}

export interface AuctionSession {
  id: number
  productId: number
  anchorId: number
  roomId: string
  status: SessionStatus
  rules: AuctionRules
  currentPrice: number
  bidCount: number
  participantCount: number
  winnerId?: number
  scheduledStartAt?: string
  startedAt?: string
  endAt?: string
  settledAt?: string
  cancelReason?: string
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: number
  orderNo: string
  sessionId: number
  productId: number
  buyerId: number
  sellerId: number
  amount: number
  status: OrderStatus
  paidAt?: string
  createdAt: string
  updatedAt: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ProductBody {
  name: string
  description: string
  coverUrl: string
  images: string[]
}

export interface PublishAuctionBody {
  startingPrice: number
  bidIncrement: number
  capPrice?: number | null
  durationSec: number
  extendThresholdSec?: number
  extendSec?: number
  scheduledStartAt?: string
}

export type LiveRoomStatus = 'idle' | 'live' | 'ended'

export type LiveRoomItemStatus = 'queued' | 'on_air' | 'sold' | 'skipped'

export interface LiveRoom {
  id: number
  anchorId: number
  title: string
  coverUrl: string
  roomId: string
  status: LiveRoomStatus
  currentSessionId?: number
  startedAt?: string
  endedAt?: string
  createdAt: string
  updatedAt: string
}

export interface LiveRoomItem {
  id: number
  productId: number
  sessionId?: number
  sortOrder: number
  status: LiveRoomItemStatus
  product?: Product
  session?: AuctionSession
}

export interface SessionSummary {
  sessionId: number
  name: string
  coverUrl?: string
  status?: SessionStatus
}

export interface RoomComment {
  id: number
  userId: number
  nickname: string
  avatar: string
  content: string
  isHidden: boolean
  createdAt: string
}

export interface LiveRoomDetail extends LiveRoom {
  items: LiveRoomItem[]
  anchor?: { id: number; nickname: string; avatar: string }
  comments?: RoomComment[]
}
