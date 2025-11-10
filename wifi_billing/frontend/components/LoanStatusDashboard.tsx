"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CreditCard,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Calendar,
  DollarSign
} from "lucide-react"
import { toast } from "sonner"
import { apiClient, Loan } from "@/lib/api"
import { wsClient } from "@/lib/api"

interface LoanStatusDashboardProps {
  className?: string
}

export default function LoanStatusDashboard({ className }: LoanStatusDashboardProps) {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadLoans()

    // Connect to WebSocket for real-time updates
    const userData = localStorage.getItem('user_data')
    if (userData) {
      const user = JSON.parse(userData)
      // Always attempt connection - WebSocket client handles cleanup
      wsClient.connect(user.phone)
    }

    // Listen for loan events
    const handleLoanCreated = (event: CustomEvent) => {
      toast.success("New loan approved!", {
        description: `You borrowed Ksh ${event.detail.amount}. Due: ${new Date(event.detail.dueAt).toLocaleDateString()}`
      })
      loadLoans()
    }

    const handleLoanRepaid = (event: CustomEvent) => {
      toast.success("Loan repaid successfully!", {
        description: "Thank you for repaying your loan."
      })
      loadLoans()
    }

    const handleLoanOverdue = (event: CustomEvent) => {
      toast.error("Loan overdue!", {
        description: "Please repay your loan to avoid penalties."
      })
      loadLoans()
    }

    window.addEventListener('loan_created', handleLoanCreated as EventListener)
    window.addEventListener('loan_repaid', handleLoanRepaid as EventListener)
    window.addEventListener('loan_overdue', handleLoanOverdue as EventListener)

    // Cleanup on unmount
    return () => {
      window.removeEventListener('loan_created', handleLoanCreated as EventListener)
      window.removeEventListener('loan_repaid', handleLoanRepaid as EventListener)
      window.removeEventListener('loan_overdue', handleLoanOverdue as EventListener)
      // Don't disconnect WebSocket here as other components might still need it
    }
  }, [])

  const loadLoans = async () => {
    try {
      const response = await apiClient.getUserLoans()
      if (response.success && response.data) {
        setLoans(response.data)
      }
    } catch (error) {
      console.error("Error loading loans:", error)
      toast.error("Failed to load loan status")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadLoans()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-500'
      case 'repaid': return 'bg-green-500'
      case 'overdue': return 'bg-red-500'
      case 'defaulted': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Clock className="w-4 h-4" />
      case 'repaid': return <CheckCircle className="w-4 h-4" />
      case 'overdue': return <AlertTriangle className="w-4 h-4" />
      case 'defaulted': return <AlertTriangle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const isOverdue = (dueAt: string) => {
    return new Date(dueAt) < new Date()
  }

  const activeLoans = loans.filter(loan => loan.status === 'active')
  const totalBorrowed = loans.reduce((sum, loan) => sum + loan.amount, 0)
  const totalRepaid = loans
    .filter(loan => loan.status === 'repaid')
    .reduce((sum, loan) => sum + (loan.repaymentAmount || 0), 0)

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Loading loan status...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Loan Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Active Loans</p>
                <p className="text-2xl font-bold">{activeLoans.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Borrowed</p>
                <p className="text-2xl font-bold">Ksh {totalBorrowed.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Repaid</p>
                <p className="text-2xl font-bold">Ksh {totalRepaid.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loan Status Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center">
            <CreditCard className="w-5 h-5 mr-2" />
            Loan Status
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No loans found</p>
              <p className="text-sm">Your loan history will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {loans.map((loan) => (
                <div
                  key={loan.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(loan.status)}
                      <div>
                        <p className="font-semibold">Loan #{loan.id}</p>
                        <p className="text-sm text-gray-600">
                          Borrowed: {new Date(loan.borrowedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge className={`${getStatusColor(loan.status)} text-white`}>
                      {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Amount</p>
                      <p className="font-semibold">Ksh {loan.amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Due Date</p>
                      <p className="font-semibold flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(loan.dueAt).toLocaleDateString()}
                      </p>
                    </div>
                    {loan.repaidAt && (
                      <div>
                        <p className="text-gray-600">Repaid</p>
                        <p className="font-semibold">
                          {new Date(loan.repaidAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {loan.repaymentAmount && (
                      <div>
                        <p className="text-gray-600">Repaid Amount</p>
                        <p className="font-semibold">Ksh {loan.repaymentAmount.toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  {loan.status === 'active' && isOverdue(loan.dueAt) && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        This loan is overdue. Please repay immediately to avoid penalties.
                      </AlertDescription>
                    </Alert>
                  )}

                  {loan.status === 'active' && !isOverdue(loan.dueAt) && (
                    <Alert className="border-blue-200 bg-blue-50">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        Due in {Math.ceil((new Date(loan.dueAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
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