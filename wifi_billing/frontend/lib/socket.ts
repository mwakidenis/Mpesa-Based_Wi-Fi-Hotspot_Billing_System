import { io, Socket } from 'socket.io-client'
import { API_BASE_URL } from './api'

// WebSocket connection for real-time updates
export class WebSocketClient {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectInterval = 5000
  private userId: number | null = null
  private userPhone: string | null = null

  connect(userId?: number, userPhone?: string) {
    this.userId = userId || null
    this.userPhone = userPhone || null
    const wsUrl = `${API_BASE_URL.replace("http", "ws")}/`

    try {
      this.socket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
      })

      this.socket.on('connect', () => {
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
        // Emit connection status event
        window.dispatchEvent(new CustomEvent("websocket_connected", { detail: { connected: true } }))
        // Join user-specific room for loan updates
        if (this.userId) {
          this.socket?.emit('join_loan_room', this.userId)
        }
        // Join support room with phone number
        if (this.userPhone) {
          this.socket?.emit('join_support', this.userPhone)
        }
      })

      this.socket.on('disconnect', () => {
        console.log('WebSocket disconnected')
        // Emit disconnection status event
        window.dispatchEvent(new CustomEvent("websocket_connected", { detail: { connected: false } }))
        this.reconnect()
      })

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error)
        this.reconnect()
      })

      // Listen for loan events
      this.socket.on('loan_created', (data: any) => {
        console.log('Loan created event:', data)
        window.dispatchEvent(new CustomEvent('loan_created', { detail: data }))
      })

      this.socket.on('loan_repaid', (data: any) => {
        console.log('Loan repaid event:', data)
        window.dispatchEvent(new CustomEvent('loan_repaid', { detail: data }))
      })

      this.socket.on('loan_overdue', (data: any) => {
        console.log('Loan overdue event:', data)
        window.dispatchEvent(new CustomEvent('loan_overdue', { detail: data }))
      })

      this.socket.on('user_balanceUpdated', (data: any) => {
        console.log('Balance updated event:', data)
        window.dispatchEvent(new CustomEvent('user_balanceUpdated', { detail: data }))
      })

      this.socket.on('user_eligibilityUpdate', (data: any) => {
        console.log('Eligibility updated event:', data)
        window.dispatchEvent(new CustomEvent('user_eligibilityUpdate', { detail: data }))
      })

      // Listen for support request events
      this.socket.on('support_status_update', (data: any) => {
        console.log('Support status update event:', data)
        window.dispatchEvent(new CustomEvent('support_request_update', { detail: data }))
      })

      this.socket.on('support_request_created', (data: any) => {
        console.log('Support request created event:', data)
        window.dispatchEvent(new CustomEvent('support_request_update', { detail: data }))
      })

    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
    }
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => {
        console.log(`Attempting to reconnect WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
        this.connect(this.userId || undefined, this.userPhone || undefined)
      }, this.reconnectInterval)
    }
  }

  disconnect() {
    if (this.socket) {
      if (this.userId) {
        this.socket.emit('leave_loan_room', this.userId)
      }
      this.socket.disconnect()
      this.socket = null
    }
  }

  send(event: string, data: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data)
    }
  }
}

export const wsClient = new WebSocketClient()
