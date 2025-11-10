// API configuration optimized for Node.js/Express backend
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

// Daraja Mpesa API base URL
export const DARAJA_API_BASE_URL = "http://localhost:3000"

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface PaymentRequest {
  phone: string
  amount: number
  package: string
  macAddress: string
  speed: string
}

export interface PaymentResponse {
  transactionId: string
  mpesaRef: string
  status: "pending" | "completed" | "failed"
  expiresAt: string | null
}

export interface User {
  id: number
  phone: string
  macAddress: string
  status: "active" | "expired" | "blocked"
  currentPackage?: string
  expiresAt?: string
  totalSpent: number
  sessionsCount: number
  lastSeen: string
}

export interface Transaction {
  id: string
  phone: string
  amount: number
  package: string
  status: "completed" | "failed" | "pending" | "refunded"
  timestamp: string
  mpesaRef: string
  mpesaReceipt?: string
}

export interface SystemStats {
  totalUsers: number
  activeUsers: number
  todayRevenue: number
  successRate: number
  pendingPayments: number
  blockedUsers: number
}

export interface LoanEligibility {
  eligible: boolean
  loanAmount?: number
  reason?: string
  recentPurchases?: number
  mostFrequentAmount?: number
}

export interface Loan {
  id: number
  userId: number
  amount: number
  status: 'active' | 'repaid' | 'overdue' | 'defaulted'
  borrowedAt: string
  dueAt: string
  repaidAt?: string
  repaymentAmount?: number
  interestRate: number
  createdAt: string
  updatedAt: string
  user: {
    username: string
    phone: string
  }
}

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      // Get auth token for protected routes - check both admin and user tokens
      const adminToken = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
      const userToken = typeof window !== 'undefined' ? localStorage.getItem('user_token') : null
      const token = adminToken || userToken
      const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
          ...options.headers,
        },
        ...options,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || "API request failed")
      }

      return data
    } catch (error) {
      console.error("API Error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }
    }
  }

  // Device & Network APIs
  async getDeviceInfo(): Promise<ApiResponse<{ macAddress: string; ipAddress: string; deviceId: string }>> {
    return this.request("/api/device/info")
  }

  async registerDevice(macAddress: string): Promise<ApiResponse<{ deviceId: string }>> {
    return this.request("/api/device/register", {
      method: "POST",
      body: JSON.stringify({ macAddress }),
    })
  }

  // Payment APIs
  async initiatePayment(paymentData: PaymentRequest): Promise<ApiResponse<PaymentResponse>> {
    // Use the backend API instead of Daraja directly
    try {
      const response = await fetch(`${API_BASE_URL}/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          phone: paymentData.phone,
          amount: paymentData.amount.toString()
        }).toString(),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Payment initiation failed")
      }

      // Transform response to match expected format
      return {
        success: true,
        data: {
          transactionId: `TXN_${Date.now()}`,
          mpesaRef: data.data?.CheckoutRequestID || data.data?.MerchantRequestID || null,
          status: "pending",
          expiresAt: null,
        },
        message: data.message || "STK Push sent!",
      }
    } catch (error) {
      console.error("Payment API Error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }
    }
  }

  async checkPaymentStatus(transactionId: string): Promise<ApiResponse<PaymentResponse>> {
    return this.request(`/api/payments/status/${transactionId}`)
  }

  async getPaymentHistory(phone: string): Promise<ApiResponse<Transaction[]>> {
    // Optional: can be implemented later via /api/transactions?search=phone
    const resp = await this.getTransactions({ search: phone, limit: 100 })
    if (!resp.success || !resp.data) return { success: false, error: resp.error }
    return { success: true, data: resp.data.transactions }
  }

  // User Management APIs
  async getUsers(params?: {
    search?: string
    status?: string
    page?: number
    limit?: number
  }): Promise<ApiResponse<{ users: User[]; total: number; page: number; totalPages: number }>> {
    const queryParams = new URLSearchParams()
    if (params?.search) queryParams.append("search", params.search)
    if (params?.status && params.status !== "all") queryParams.append("status", params.status)
    if (params?.page) queryParams.append("page", params.page.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    return this.request(`/api/users?${queryParams.toString()}`)
  }

  async getUserDetails(userId: number): Promise<ApiResponse<User & { transactions: Transaction[] }>> {
    return this.request(`/api/users/${userId}`)
  }

  async blockUser(userId: number): Promise<ApiResponse> {
    return this.request(`/api/users/${userId}/block`, { method: "POST" })
  }

  async unblockUser(userId: number): Promise<ApiResponse> {
    return this.request(`/api/users/${userId}/unblock`, { method: "POST" })
  }

  async deleteUser(userId: number): Promise<ApiResponse> {
    return this.request(`/api/users/${userId}`, { method: "DELETE" })
  }

  async disconnectUser(userId: number): Promise<ApiResponse> {
    return this.request(`/api/users/${userId}/disconnect`, { method: "POST" })
  }

  // Transaction APIs
  async getTransactions(params?: {
    search?: string
    status?: string
    page?: number
    limit?: number
    startDate?: string
    endDate?: string
  }): Promise<ApiResponse<{ transactions: Transaction[]; total: number; page: number; totalPages: number }>> {
    const queryParams = new URLSearchParams()
    if (params?.search) queryParams.append("search", params.search)
    if (params?.status && params.status !== "all") queryParams.append("status", params.status)
    if (params?.page) queryParams.append("page", params.page.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.startDate) queryParams.append("startDate", params.startDate)
    if (params?.endDate) queryParams.append("endDate", params.endDate)
    return this.request(`/api/transactions?${queryParams.toString()}`)
  }

  async refundTransaction(transactionId: string, reason?: string): Promise<ApiResponse> {
    return this.request(`/api/transactions/${transactionId}/refund`, { method: "POST", body: JSON.stringify({ reason }) })
  }

  async downloadReceipt(transactionId: string): Promise<ApiResponse<{ receiptUrl: string }>> {
    return this.request(`/api/transactions/${transactionId}/receipt`)
  }

  // Auth APIs
  async register(data: {
    username: string
    email?: string
    phone: string
    password: string
  }): Promise<ApiResponse<{
    user: { id: number; username: string; email: string | null; phone: string }
    token: string
  }>> {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async login(data: { username: string; password: string }): Promise<ApiResponse<{
    user: { id: number; username: string; email: string | null; phone: string }
    token: string
  }>> {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  // Support APIs
  async submitSupportRequest(data: {
    name: string
    phone: string
    transactionCode: string
    message: string
  }): Promise<ApiResponse> {
    return this.request("/api/support/submit", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async getSupportRequests(params?: {
    status?: string
    page?: number
    limit?: number
    search?: string
  }): Promise<ApiResponse<{ requests: any[]; total: number; page: number; totalPages: number }>> {
    const queryParams = new URLSearchParams()
    if (params?.status) queryParams.append("status", params.status)
    if (params?.page) queryParams.append("page", params.page.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.search) queryParams.append("search", params.search)
    return this.request(`/api/support/requests?${queryParams.toString()}`)
  }

  async updateSupportRequestStatus(id: number, status: string): Promise<ApiResponse> {
    return this.request(`/api/support/requests/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    })
  }

  async getSupportRequest(id: number): Promise<ApiResponse<any>> {
    return this.request(`/api/support/requests/${id}`)
  }

  async getUserSupportRequests(phone: string): Promise<ApiResponse<any[]>> {
    return this.request(`/api/support/user/requests?phone=${encodeURIComponent(phone)}`)
  }

  // System APIs
  async getSystemStats(): Promise<ApiResponse<SystemStats>> {
    const resp = await this.request<any>("/api/admin/summary")
    if (!resp.success || !resp.data) {
      return { success: false, error: resp.error || "Failed to load stats" }
    }
    const data = resp.data as any
    const mapped: SystemStats = {
      totalUsers: Number(data.totalUsers) || 0,
      activeUsers: Number(data.activeSessions) || 0,
      todayRevenue: Number(data.totalRevenue) || 0,
      successRate: 0,
      pendingPayments: Number(data.pendingPayments) || 0,
      blockedUsers: 0,
    }
    return { success: true, data: mapped }
  }

  async getSystemSettings(): Promise<ApiResponse<any>> {
    return { success: true, data: { } }
  }

  async updateSystemSettings(settings: any): Promise<ApiResponse> {
    return { success: true }
  }

  async restartNetworkService(): Promise<ApiResponse> {
    return { success: false, error: "Not implemented" }
  }

  async backupDatabase(): Promise<ApiResponse<{ backupFile: string }>> {
    return { success: false, error: "Not implemented" }
  }

  async getSystemLogs(params?: { level?: string; limit?: number }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams()
    if (params?.level) queryParams.append("level", params.level)
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    return this.request(`/api/system/logs?${queryParams.toString()}`)
  }

  // Network Management APIs
  async getConnectedDevices(): Promise<ApiResponse<any[]>> {
    return this.request("/api/network/devices")
  }

  async disconnectAllUsers(): Promise<ApiResponse> {
    return this.request("/api/network/disconnect-all", { method: "POST" })
  }

  async getNetworkStatus(): Promise<ApiResponse<{ status: string; uptime: number; connectedUsers: number }>> {
    return this.request("/api/network/status")
  }

  // Loan APIs
  async checkLoanEligibility(): Promise<ApiResponse<LoanEligibility>> {
    return this.request("/api/loans/eligibility")
  }

  async requestLoan(amount: number): Promise<ApiResponse<Loan>> {
    return this.request("/api/loans/request", {
      method: "POST",
      body: JSON.stringify({ amount }),
    })
  }

  async repayLoan(loanId: number, amount: number): Promise<ApiResponse<Loan>> {
    return this.request(`/api/loans/repay/${loanId}`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    })
  }

  async getUserLoans(): Promise<ApiResponse<Loan[]>> {
    return this.request("/api/loans/status")
  }

  // Admin Loan APIs
  async getAllLoans(params?: {
    status?: string
    userId?: number
  }): Promise<ApiResponse<Loan[]>> {
    const queryParams = new URLSearchParams()
    if (params?.status) queryParams.append("status", params.status)
    if (params?.userId) queryParams.append("userId", params.userId.toString())
    return this.request(`/api/loans/admin/all?${queryParams.toString()}`)
  }

  async createBypassLoan(userId: number, amount: number): Promise<ApiResponse<Loan>> {
    return this.request("/api/loans/admin/bypass", {
      method: "POST",
      body: JSON.stringify({ userId, amount }),
    })
  }

  async updateLoanStatus(loanId: number, status: string): Promise<ApiResponse<Loan>> {
    return this.request(`/api/loans/admin/${loanId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    })
  }
}

export const apiClient = new ApiClient()

// WebSocket connection for real-time updates
export class WebSocketClient {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectInterval = 5000
  private phone: string | null = null

  connect(phone?: string) {
    // Clean up existing connection first
    if (this.ws) {
      console.log("Cleaning up existing WebSocket connection")
      this.ws.close(1000, "New connection requested")
      this.ws = null
    }

    this.phone = phone || null
    const wsUrl = `${API_BASE_URL.replace("http", "ws")}/ws`

    try {
      console.log("Creating new WebSocket connection to:", wsUrl)
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log("WebSocket connected successfully")
        this.reconnectAttempts = 0
        // Emit connection status event
        window.dispatchEvent(new CustomEvent("websocket_connected", { detail: { connected: true } }))
        // Subscribe to support updates for this phone
        if (this.phone) {
          this.send({ type: "join_support", phone: this.phone })
        }
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.handleMessage(data)
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error)
        }
      }

      this.ws.onclose = (event) => {
        console.log("WebSocket disconnected:", event.code, event.reason)
        // Emit disconnection status event
        window.dispatchEvent(new CustomEvent("websocket_connected", { detail: { connected: false } }))
        // Only reconnect if it wasn't a clean close and we haven't exceeded max attempts
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnect()
        }
      }

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error)
        // Emit disconnection status event
        window.dispatchEvent(new CustomEvent("websocket_connected", { detail: { connected: false } }))
      }
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error)
    }
  }

  private handleMessage(data: any) {
    // Emit custom events for different message types
    if (data.type === "payment_status") {
      window.dispatchEvent(
        new CustomEvent("payment_status_update", {
          detail: data.payload,
        }),
      )
    } else if (data.type === "user_connected") {
      window.dispatchEvent(
        new CustomEvent("user_connected", {
          detail: data.payload,
        }),
      )
    } else if (data.type === "user_disconnected") {
      window.dispatchEvent(
        new CustomEvent("user_disconnected", {
          detail: data.payload,
        }),
      )
    } else if (data.type === "support_request_update") {
      window.dispatchEvent(
        new CustomEvent("support_request_update", {
          detail: data.payload,
        }),
      )
    } else if (data.type === "loan_created") {
      window.dispatchEvent(
        new CustomEvent("loan_created", {
          detail: data,
        }),
      )
    } else if (data.type === "loan_repaid") {
      window.dispatchEvent(
        new CustomEvent("loan_repaid", {
          detail: data,
        }),
      )
    } else if (data.type === "loan_overdue") {
      window.dispatchEvent(
        new CustomEvent("loan_overdue", {
          detail: data,
        }),
      )
    }
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => {
        console.log(`Attempting to reconnect WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
        this.connect(this.phone || undefined)
      }, this.reconnectInterval)
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }
}

export const wsClient = new WebSocketClient()
