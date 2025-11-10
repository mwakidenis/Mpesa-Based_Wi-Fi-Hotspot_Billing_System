"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Clock,
  CreditCard,
  X,
  Trash2
} from "lucide-react"
import { toast } from "sonner"
import { wsClient } from "@/lib/api"

interface LoanNotification {
  id: string
  type: 'loan_approved' | 'loan_overdue' | 'loan_repaid' | 'loan_reminder'
  title: string
  message: string
  timestamp: Date
  read: boolean
  data?: any
}

interface LoanNotificationCenterProps {
  className?: string
}

export default function LoanNotificationCenter({ className }: LoanNotificationCenterProps) {
  const [notifications, setNotifications] = useState<LoanNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    // Load notifications from localStorage
    loadNotifications()

    // Connect to WebSocket for real-time updates
    const userData = localStorage.getItem('user_data')
    if (userData) {
      const user = JSON.parse(userData)
      // Only connect if not already connected to avoid multiple connections
      wsClient.connect(user.phone)
    }

    // Listen for loan events
    const handleLoanCreated = (event: CustomEvent) => {
      addNotification({
        type: 'loan_approved',
        title: 'Loan Approved!',
        message: `Your loan of Ksh ${event.detail.amount} has been approved. Due: ${new Date(event.detail.dueAt).toLocaleDateString()}`,
        data: event.detail
      })
    }

    const handleLoanRepaid = (event: CustomEvent) => {
      addNotification({
        type: 'loan_repaid',
        title: 'Loan Repaid',
        message: 'Your loan has been successfully repaid. Thank you!',
        data: event.detail
      })
    }

    const handleLoanOverdue = (event: CustomEvent) => {
      addNotification({
        type: 'loan_overdue',
        title: 'Loan Overdue!',
        message: 'Your loan is now overdue. Please repay immediately to avoid penalties.',
        data: event.detail
      })
    }

    window.addEventListener('loan_created', handleLoanCreated as EventListener)
    window.addEventListener('loan_repaid', handleLoanRepaid as EventListener)
    window.addEventListener('loan_overdue', handleLoanOverdue as EventListener)

    // Set up reminder notifications
    const reminderInterval = setInterval(() => {
      checkForReminders()
    }, 60000) // Check every minute

    return () => {
      window.removeEventListener('loan_created', handleLoanCreated as EventListener)
      window.removeEventListener('loan_repaid', handleLoanRepaid as EventListener)
      window.removeEventListener('loan_overdue', handleLoanOverdue as EventListener)
      clearInterval(reminderInterval)
      wsClient.disconnect()
    }
  }, [])

  const loadNotifications = () => {
    const stored = localStorage.getItem('loan_notifications')
    if (stored) {
      const parsed = JSON.parse(stored)
      const notificationsWithDates = parsed.map((n: any) => ({
        ...n,
        timestamp: new Date(n.timestamp)
      }))
      setNotifications(notificationsWithDates)
      setUnreadCount(notificationsWithDates.filter((n: LoanNotification) => !n.read).length)
    }
  }

  const saveNotifications = (notifications: LoanNotification[]) => {
    localStorage.setItem('loan_notifications', JSON.stringify(notifications))
    setUnreadCount(notifications.filter(n => !n.read).length)
  }

  const addNotification = (notificationData: Omit<LoanNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: LoanNotification = {
      ...notificationData,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false
    }

    setNotifications(prev => {
      const updated = [newNotification, ...prev].slice(0, 50) // Keep only last 50
      saveNotifications(updated)
      return updated
    })

    // Show toast for important notifications
    if (notificationData.type === 'loan_overdue') {
      toast.error(notificationData.title, {
        description: notificationData.message,
        duration: 10000
      })
    } else {
      toast.success(notificationData.title, {
        description: notificationData.message,
        duration: 5000
      })
    }
  }

  const checkForReminders = () => {
    // Check for loans due in 2 days
    const storedLoans = localStorage.getItem('user_loans')
    if (storedLoans) {
      const loans = JSON.parse(storedLoans)
      const now = new Date()
      const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)

      loans.forEach((loan: any) => {
        if (loan.status === 'active') {
          const dueDate = new Date(loan.dueAt)
          if (dueDate <= twoDaysFromNow && dueDate > now) {
            const existingReminder = notifications.find(
              n => n.type === 'loan_reminder' && n.data?.loanId === loan.id
            )

            if (!existingReminder) {
              addNotification({
                type: 'loan_reminder',
                title: 'Loan Due Soon',
                message: `Your loan of Ksh ${loan.amount} is due on ${dueDate.toLocaleDateString()}. Please prepare to repay.`,
                data: { loanId: loan.id }
              })
            }
          }
        }
      })
    }
  }

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
    saveNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    saveNotifications(notifications.map(n => ({ ...n, read: true })))
  }

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    saveNotifications(notifications.filter(n => n.id !== id))
  }

  const clearAllNotifications = () => {
    setNotifications([])
    localStorage.removeItem('loan_notifications')
    setUnreadCount(0)
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'loan_approved': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'loan_overdue': return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'loan_repaid': return <CheckCircle className="w-4 h-4 text-blue-500" />
      case 'loan_reminder': return <Clock className="w-4 h-4 text-orange-500" />
      default: return <Bell className="w-4 h-4 text-gray-500" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'loan_approved': return 'border-green-200 bg-green-50'
      case 'loan_overdue': return 'border-red-200 bg-red-50'
      case 'loan_repaid': return 'border-blue-200 bg-blue-50'
      case 'loan_reminder': return 'border-orange-200 bg-orange-50'
      default: return 'border-gray-200 bg-gray-50'
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <Bell className="w-5 h-5 mr-2" />
          Loan Notifications
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadCount}
            </Badge>
          )}
        </CardTitle>
        <div className="flex space-x-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              Mark All Read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearAllNotifications}>
              <Trash2 className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No notifications yet</p>
            <p className="text-sm">Loan-related notifications will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {notifications.map((notification, index) => (
                <div key={notification.id}>
                  <div
                    className={`p-4 rounded-lg border ${getNotificationColor(notification.type)} ${
                      !notification.read ? 'ring-2 ring-blue-200' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-semibold text-sm">{notification.title}</h4>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 mt-1">{notification.message}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            {notification.timestamp.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsRead(notification.id)}
                            className="h-6 w-6 p-0"
                          >
                            <CheckCircle className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteNotification(notification.id)}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {index < notifications.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}