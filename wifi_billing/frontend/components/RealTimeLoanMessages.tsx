"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  MessageSquare,
  Wifi,
  CreditCard,
  CheckCircle,
  AlertTriangle,
  Clock,
  Zap,
  RefreshCw
} from "lucide-react"
import { toast } from "sonner"
import { wsClient } from "@/lib/api"

interface LoanMessage {
  id: string
  type: 'loan_status' | 'payment_update' | 'system_message' | 'user_notification'
  title: string
  message: string
  timestamp: Date
  priority: 'low' | 'medium' | 'high' | 'urgent'
  data?: any
}

interface RealTimeLoanMessagesProps {
  className?: string
}

export default function RealTimeLoanMessages({ className }: RealTimeLoanMessagesProps) {
  const [messages, setMessages] = useState<LoanMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Connect to WebSocket
    const userData = localStorage.getItem('user_data')
    if (userData) {
      const user = JSON.parse(userData)
      // Always attempt connection - WebSocket client handles cleanup
      wsClient.connect(user.phone)
    }

    // Listen for WebSocket connection status
    const handleConnectionChange = (event: CustomEvent) => {
      setIsConnected(event.detail.connected)
      setConnectionStatus(event.detail.connected ? 'connected' : 'disconnected')
    }

    // Listen for loan events
    const handleLoanCreated = (event: CustomEvent) => {
      addMessage({
        type: 'loan_status',
        title: 'Loan Approved',
        message: `Your loan request for Ksh ${event.detail.amount} has been approved.`,
        priority: 'high',
        data: event.detail
      })
    }

    const handleLoanRepaid = (event: CustomEvent) => {
      addMessage({
        type: 'loan_status',
        title: 'Loan Repaid',
        message: 'Your loan has been successfully repaid.',
        priority: 'medium',
        data: event.detail
      })
    }

    const handleLoanOverdue = (event: CustomEvent) => {
      addMessage({
        type: 'loan_status',
        title: 'Loan Overdue',
        message: 'Your loan is now overdue. Please repay immediately.',
        priority: 'urgent',
        data: event.detail
      })
    }

    // Listen for payment updates
    const handlePaymentStatus = (event: CustomEvent) => {
      const { status, amount } = event.detail
      addMessage({
        type: 'payment_update',
        title: 'Payment Update',
        message: `Your payment of Ksh ${amount} is now ${status}.`,
        priority: status === 'completed' ? 'high' : 'medium',
        data: event.detail
      })
    }

    window.addEventListener('websocket_connected', handleConnectionChange as EventListener)
    window.addEventListener('loan_created', handleLoanCreated as EventListener)
    window.addEventListener('loan_repaid', handleLoanRepaid as EventListener)
    window.addEventListener('loan_overdue', handleLoanOverdue as EventListener)
    window.addEventListener('payment_status_update', handlePaymentStatus as EventListener)

    // Add welcome message
    addMessage({
      type: 'system_message',
      title: 'Welcome to Okoa WiFi',
      message: 'Real-time loan and payment updates will appear here.',
      priority: 'low'
    })

    return () => {
      window.removeEventListener('websocket_connected', handleConnectionChange as EventListener)
      window.removeEventListener('loan_created', handleLoanCreated as EventListener)
      window.removeEventListener('loan_repaid', handleLoanRepaid as EventListener)
      window.removeEventListener('loan_overdue', handleLoanOverdue as EventListener)
      window.removeEventListener('payment_status_update', handlePaymentStatus as EventListener)
      wsClient.disconnect()
    }
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  const addMessage = (messageData: Omit<LoanMessage, 'id' | 'timestamp'>) => {
    const newMessage: LoanMessage = {
      ...messageData,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date()
    }

    setMessages(prev => {
      // Keep only last 100 messages
      const updated = [...prev, newMessage].slice(-100)
      return updated
    })

    // Show toast for high priority messages
    if (messageData.priority === 'urgent') {
      toast.error(messageData.title, {
        description: messageData.message,
        duration: 10000
      })
    } else if (messageData.priority === 'high') {
      toast.success(messageData.title, {
        description: messageData.message,
        duration: 5000
      })
    }
  }

  const clearMessages = () => {
    setMessages([])
  }

  const getMessageIcon = (type: string, priority: string) => {
    if (priority === 'urgent') return <AlertTriangle className="w-4 h-4 text-red-500" />
    if (priority === 'high') return <CheckCircle className="w-4 h-4 text-green-500" />

    switch (type) {
      case 'loan_status': return <CreditCard className="w-4 h-4 text-blue-500" />
      case 'payment_update': return <Wifi className="w-4 h-4 text-purple-500" />
      case 'system_message': return <MessageSquare className="w-4 h-4 text-gray-500" />
      default: return <MessageSquare className="w-4 h-4 text-gray-500" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-red-200 bg-red-50'
      case 'high': return 'border-green-200 bg-green-50'
      case 'medium': return 'border-blue-200 bg-blue-50'
      case 'low': return 'border-gray-200 bg-gray-50'
      default: return 'border-gray-200 bg-gray-50'
    }
  }

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-500'
      case 'connecting': return 'text-yellow-500'
      case 'disconnected': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <CheckCircle className="w-4 h-4" />
      case 'connecting': return <RefreshCw className="w-4 h-4 animate-spin" />
      case 'disconnected': return <AlertTriangle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <MessageSquare className="w-5 h-5 mr-2" />
          Real-Time Messages
          <div className={`flex items-center ml-4 text-sm ${getConnectionStatusColor()}`}>
            {getConnectionStatusIcon()}
            <span className="ml-1 capitalize">{connectionStatus}</span>
          </div>
        </CardTitle>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={clearMessages}>
            Clear All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No messages yet</p>
            <p className="text-sm">Real-time updates will appear here</p>
          </div>
        ) : (
          <ScrollArea ref={scrollAreaRef} className="h-96">
            <div className="space-y-2">
              {messages.map((message, index) => (
                <div key={message.id}>
                  <div className={`p-4 rounded-lg border ${getPriorityColor(message.priority)}`}>
                    <div className="flex items-start space-x-3">
                      {getMessageIcon(message.type, message.priority)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-semibold text-sm">{message.title}</h4>
                          <Badge variant="outline" className="text-xs">
                            {message.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-700">{message.message}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  {index < messages.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {!isConnected && (
          <div className="mt-4">
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Real-time updates are currently unavailable. Please check your connection.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  )
}