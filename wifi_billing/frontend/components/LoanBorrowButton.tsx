"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CreditCard, CheckCircle, AlertTriangle, Clock, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"

interface LoanBorrowButtonProps {
  amount: number
  onLoanSuccess?: (loanData: any) => void
  className?: string
}

export default function LoanBorrowButton({ amount, onLoanSuccess, className }: LoanBorrowButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [eligibility, setEligibility] = useState<any>(null)
  const [checkingEligibility, setCheckingEligibility] = useState(false)

  useEffect(() => {
    checkEligibility()
  }, [])

  const checkEligibility = async () => {
    setCheckingEligibility(true)
    try {
      const response = await apiClient.checkLoanEligibility()
      if (response.success) {
        setEligibility(response.data)
      } else {
        console.error("Eligibility check failed:", response.error)
      }
    } catch (error) {
      console.error("Error checking eligibility:", error)
    } finally {
      setCheckingEligibility(false)
    }
  }

  const handleBorrowLoan = async () => {
    if (!eligibility?.eligible) {
      toast.error("Not eligible for loan", {
        description: eligibility?.reason || "You don't meet the loan requirements"
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await apiClient.requestLoan(amount)

      if (response.success) {
        toast.success("Loan approved!", {
          description: `You borrowed Ksh ${amount}. Repay by ${new Date(response.data.dueAt).toLocaleDateString()}`
        })

        // Refresh eligibility
        await checkEligibility()

        // Call success callback
        if (onLoanSuccess) {
          onLoanSuccess(response.data)
        }
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
    } finally {
      setIsLoading(false)
    }
  }

  if (checkingEligibility) {
    return (
      <Button
        disabled
        className={`w-full ${className}`}
        variant="outline"
      >
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Checking eligibility...
      </Button>
    )
  }

  if (!eligibility) {
    return (
      <Button
        disabled
        className={`w-full ${className}`}
        variant="outline"
      >
        <AlertTriangle className="w-4 h-4 mr-2" />
        Unable to check eligibility
      </Button>
    )
  }

  if (!eligibility.eligible) {
    return (
      <Button
        disabled
        className={`w-full ${className}`}
        variant="outline"
      >
        <AlertTriangle className="w-4 h-4 mr-2" />
        Not eligible for loan
      </Button>
    )
  }

  return (
    <Button
      onClick={handleBorrowLoan}
      disabled={isLoading}
      className={`w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white ${className}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Processing loan...
        </>
      ) : (
        <>
          <CreditCard className="w-4 h-4 mr-2" />
          Borrow Ksh {amount} (Okoa)
        </>
      )}
    </Button>
  )
}
