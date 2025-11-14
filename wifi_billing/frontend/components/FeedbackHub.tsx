"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  MessageSquare,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Calendar,
  HelpCircle,
  Loader2,
  ExternalLink
} from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"
import { wsClient } from "@/lib/api"

interface SupportRequest {
  id: number
  name: string
  phone: string
  transactionCode: string
  message: string
  status: "pending" | "in_progress" | "resolved" | "closed"
  createdAt: string
  updatedAt: string
}

interface FeedbackHubProps {
  className?: string
}

export default function FeedbackHub({ className }: FeedbackHubProps) {
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userPhone, setUserPhone] = useState<string>('')

  useEffect(() => {
    // Get user phone from localStorage
    const userData = localStorage.getItem('user_data')
    console.log('FeedbackHub: Checking user data:', userData)
    if (userData) {
      const user = JSON.parse(userData)
      console.log('FeedbackHub: User found:', user)
      setUserPhone(user.phone)
      loadSupportRequests(user.phone)

      // Connect to WebSocket for real-time updates
      wsClient.connect(user.id, user.phone)
    } else {
      console.log('FeedbackHub: No user data found')
    }

    // Listen for support request events
    const handleSupportUpdate = (event: CustomEvent) => {
      console.log('Support request update received:', event.detail)
      if (userData) {
        const user = JSON.parse(userData)
        loadSupportRequests(user.phone)
      }
    }

    window.addEventListener('support_request_update', handleSupportUpdate as EventListener)

    // Cleanup on unmount
    return () => {
      window.removeEventListener('support_request_update', handleSupportUpdate as EventListener)
      // Don't disconnect WebSocket here as other components might still need it
    }
  }, [])

  // Also listen for user data changes (in case user logs in after component mounts)
  useEffect(() => {
    const checkUserData = () => {
      const userData = localStorage.getItem('user_data')
      if (userData && !userPhone) {
        const user = JSON.parse(userData)
        setUserPhone(user.phone)
        loadSupportRequests(user.phone)
        wsClient.connect(user.id, user.phone)
      }
    }

    // Check immediately
    checkUserData()

    // Also check periodically in case user logs in
    const interval = setInterval(checkUserData, 1000)
    return () => clearInterval(interval)
  }, [userPhone])

  const loadSupportRequests = async (phone: string) => {
    console.log('FeedbackHub: Loading support requests for phone:', phone)
    try {
      const response = await apiClient.getUserSupportRequests(phone)
      console.log('FeedbackHub: API response:', response)
      if (response.success && response.data) {
        console.log('FeedbackHub: Setting requests:', response.data.length)
        setRequests(response.data)
      } else {
        console.log('FeedbackHub: API call failed:', response.error)
      }
    } catch (error) {
      console.error("Error loading support requests:", error)
      toast.error("Failed to load support requests")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    if (userPhone) {
      await loadSupportRequests(userPhone)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500'
      case 'in_progress': return 'bg-blue-500'
      case 'resolved': return 'bg-green-500'
      case 'closed': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />
      case 'in_progress': return <RefreshCw className="w-4 h-4" />
      case 'resolved': return <CheckCircle className="w-4 h-4" />
      case 'closed': return <AlertTriangle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      pending: { color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400", label: "Pending" },
      in_progress: { color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", label: "In Progress" },
      resolved: { color: "bg-green-500/10 text-green-600 dark:text-green-400", label: "Resolved" },
      closed: { color: "bg-gray-500/10 text-gray-600 dark:text-gray-400", label: "Closed" },
    }
    const config = statusConfig[status] || statusConfig.pending
    return <Badge className={`${config.color} border-0`}>{config.label}</Badge>
  }

  const pendingRequests = requests.filter(req => req.status === 'pending')
  const inProgressRequests = requests.filter(req => req.status === 'in_progress')
  const resolvedRequests = requests.filter(req => req.status === 'resolved')

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Loading feedback...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Feedback Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-2xl font-bold">{requests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold">{pendingRequests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold">{inProgressRequests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Resolved</p>
                <p className="text-2xl font-bold">{resolvedRequests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Support Requests Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center">
            <MessageSquare className="w-5 h-5 mr-2" />
            Support Requests & Feedback
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('/support', '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Submit New
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No support requests yet</p>
              <p className="text-sm">Your feedback and support requests will appear here</p>
              <Button
                className="mt-4"
                onClick={() => window.open('/support', '_blank')}
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                Get Support
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {requests
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((request) => (
                <div
                  key={request.id}
                  className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(request.status)}
                      <div>
                        <p className="font-semibold">Request #{request.id}</p>
                        <p className="text-sm text-gray-600">
                          Submitted: {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>

                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    <p className="font-medium mb-1">Issue:</p>
                    <p className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-sm">
                      {request.message}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Transaction Code</p>
                      <p className="font-mono font-semibold">{request.transactionCode}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Last Updated</p>
                      <p className="font-semibold flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(request.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Status</p>
                      <p className="font-semibold capitalize">{request.status.replace('_', ' ')}</p>
                    </div>
                  </div>

                  {request.status === 'pending' && (
                    <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                        Your request is pending review. We'll get back to you soon.
                      </AlertDescription>
                    </Alert>
                  )}

                  {request.status === 'in_progress' && (
                    <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                      <RefreshCw className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800 dark:text-blue-200">
                        We're working on your request. Updates will appear here automatically.
                      </AlertDescription>
                    </Alert>
                  )}

                  {request.status === 'resolved' && (
                    <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        Your request has been resolved. Thank you for your feedback!
                      </AlertDescription>
                    </Alert>
                  )}

                  {request.status === 'closed' && (
                    <Alert className="border-gray-200 bg-gray-50 dark:bg-gray-950/20">
                      <AlertTriangle className="h-4 w-4 text-gray-600" />
                      <AlertDescription className="text-gray-800 dark:text-gray-200">
                        This request has been closed. If you need further assistance, please submit a new request.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}