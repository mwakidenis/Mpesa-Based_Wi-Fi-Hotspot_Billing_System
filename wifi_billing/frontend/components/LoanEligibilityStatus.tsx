"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Calendar
} from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"
import { wsClient } from "@/lib/api"

interface LoanEligibility {
  eligible: boolean
  loanAmount?: number
  reason?: string
  recentPurchases?: number
  mostFrequentAmount?: number
}

interface LoanEligibilityStatusProps {
  className?: string
  showActions?: boolean
}

export default function LoanEligibilityStatus({ className, showActions = true }: LoanEligibilityStatusProps) {
  const [eligibility, setEligibility] = useState<LoanEligibility | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  useEffect(() => {
    checkEligibility()

    // Connect to WebSocket for real-time updates
    const userData = localStorage.getItem('user_data')
    if (userData) {
      const user = JSON.parse(userData)
      wsClient.connect(user.phone)
    }

    // Listen for loan eligibility updates
    const handleEligibilityUpdate = (event: CustomEvent) => {
      console.log('Loan eligibility updated:', event.detail)
      checkEligibility()
    }

    const handleLoanCreated = (event: CustomEvent) => {
      console.log('Loan created, refreshing eligibility')
      checkEligibility()
    }

    const handleLoanEligibilityChecked = (event: CustomEvent) => {
      console.log('Loan eligibility checked:', event.detail)
      // Update local state with real-time eligibility data
      if (event.detail) {
        setEligibility({
          eligible: event.detail.eligible,
          reason: event.detail.reason,
          loanAmount: event.detail.loanAmount,
          recentPurchases: event.detail.recentPurchases,
          mostFrequentAmount: event.detail.loanAmount
        })
        setLastChecked(new Date(event.detail.checkedAt))
      }
    }

    const handleLoanApplicationResult = (event: CustomEvent) => {
      console.log('Loan application result:', event.detail)
      const result = event.detail

      if (result.status === 'approved') {
        toast.success("Loan Approved!", {
          description: `You borrowed Ksh ${result.amount}. Due: ${new Date(result.dueAt).toLocaleDateString()}`
        })
        // Refresh eligibility after loan approval
        checkEligibility()
      } else if (result.status === 'rejected') {
        toast.error("Loan Rejected", {
          description: result.reason || "Your loan application was not approved."
        })
        // Update eligibility status to show rejection
        setEligibility(prev => prev ? { ...prev, eligible: false, reason: result.reason } : null)
      }
    }

    window.addEventListener('user_eligibilityUpdate', handleEligibilityUpdate as EventListener)
    window.addEventListener('loan_created', handleLoanCreated as EventListener)
    window.addEventListener('loan_eligibility_checked', handleLoanEligibilityChecked as EventListener)
    window.addEventListener('loan_application_result', handleLoanApplicationResult as EventListener)

    // Cleanup
    return () => {
      window.removeEventListener('user_eligibilityUpdate', handleEligibilityUpdate as EventListener)
      window.removeEventListener('loan_created', handleLoanCreated as EventListener)
      window.removeEventListener('loan_eligibility_checked', handleLoanEligibilityChecked as EventListener)
      window.removeEventListener('loan_application_result', handleLoanApplicationResult as EventListener)
    }
  }, [])

  const checkEligibility = async () => {
    try {
      const response = await apiClient.checkLoanEligibility()
      if (response.success && response.data) {
        setEligibility(response.data)
        setLastChecked(new Date())

        // Emit eligibility update event for other components
        window.dispatchEvent(new CustomEvent('user_eligibilityUpdate', {
          detail: response.data
        }))
      } else {
        console.error("Eligibility check failed:", response.error)
        toast.error("Failed to check loan eligibility")
      }
    } catch (error) {
      console.error("Error checking eligibility:", error)
      toast.error("Failed to check loan eligibility")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await checkEligibility()
  }

  const handleRequestLoan = async (amount: number) => {
    if (!eligibility?.eligible) {
      toast.error("Not eligible for loan", {
        description: eligibility?.reason || "You don't meet the loan requirements"
      })
      return
    }

    try {
      const response = await apiClient.requestLoan(amount)

      if (response.success && response.data) {
        toast.success("Loan approved!", {
          description: `You borrowed Ksh ${amount}. Repay by ${new Date(response.data.dueAt).toLocaleDateString()}`
        })

        // Refresh eligibility after loan creation
        await checkEligibility()

        // Emit loan created event
        window.dispatchEvent(new CustomEvent('loan_created', {
          detail: response.data
        }))

      } else {
        toast.error("Loan request failed", {
          description: response.error || "Unable to process loan request"
        })
      }
    } catch (error) {
      console.error("Error requesting loan:", error)
      toast.error("Loan request failed", {
        description: "An unexpected error occurred"
      })
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Checking loan eligibility...
        </CardContent>
      </Card>
    )
  }

  if (!eligibility) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <AlertTriangle className="w-6 h-6 text-yellow-500 mr-2" />
          Unable to check loan eligibility
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          Loan Eligibility Status
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {lastChecked && (
            <span className="text-xs text-gray-500">
              Last checked: {lastChecked.toLocaleTimeString()}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Eligibility Status */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center space-x-3">
            {eligibility.eligible ? (
              <CheckCircle className="w-8 h-8 text-green-500" />
            ) : (
              <XCircle className="w-8 h-8 text-red-500" />
            )}
            <div>
              <p className="font-semibold">
                {eligibility.eligible ? "Eligible for Loan" : "Not Eligible for Loan"}
              </p>
              <p className="text-sm text-gray-600">
                {eligibility.eligible
                  ? `You can borrow up to Ksh ${eligibility.loanAmount}`
                  : eligibility.reason || "You don't meet the loan requirements"
                }
              </p>
            </div>
          </div>
          <Badge className={eligibility.eligible ? "bg-green-500" : "bg-red-500"}>
            {eligibility.eligible ? "Approved" : "Rejected"}
          </Badge>
        </div>

        {/* Eligibility Details */}
        {eligibility.eligible && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Loan Amount</span>
              </div>
              <p className="text-lg font-bold text-green-900">Ksh {eligibility.loanAmount}</p>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Repayment Period</span>
              </div>
              <p className="text-lg font-bold text-blue-900">7 Days</p>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {eligibility.recentPurchases !== undefined && (
          <div className="p-3 bg-gray-50 border rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Recent Purchases (7 days)</span>
              <span className="text-lg font-bold">{eligibility.recentPurchases}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {showActions && (
          <div className="flex gap-2">
            {eligibility.eligible ? (
              <Button
                onClick={() => handleRequestLoan(eligibility.loanAmount!)}
                className="flex-1 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Apply for Loan (Ksh {eligibility.loanAmount})
              </Button>
            ) : (
              <Button
                disabled
                className="flex-1"
                variant="outline"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Loan Application Rejected
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        )}

        {/* Status Alert */}
        {!eligibility.eligible && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Loan Application Status: Rejected</strong><br />
              {eligibility.reason || "You don't meet the current loan requirements. Try making more purchases to become eligible."}
            </AlertDescription>
          </Alert>
        )}

        {eligibility.eligible && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Loan Application Status: Approved</strong><br />
              You are eligible to borrow up to Ksh {eligibility.loanAmount}. Click "Apply for Loan" to proceed.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}