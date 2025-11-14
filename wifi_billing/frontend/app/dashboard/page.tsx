"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api"
import { useUserAuth } from "@/hooks/use-user-auth"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ToastProvider } from "@/components/toast-provider"
import LoanStatusDashboard from "@/components/LoanStatusDashboard"
import LoanNotificationCenter from "@/components/LoanNotificationCenter"
import RealTimeLoanMessages from "@/components/RealTimeLoanMessages"
import LoanBorrowButton from "@/components/LoanBorrowButton"
import LoanEligibilityStatus from "@/components/LoanEligibilityStatus"
import FeedbackHub from "@/components/FeedbackHub"

interface Loan {
  id: number
  amount: number
  status: "active" | "repaid" | "overdue" | "defaulted"
  borrowedAt: string
  dueAt: string
  repaidAt?: string
  repaymentAmount?: number
  interestRate: number
}

export default function DashboardPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const { user, logout, loading: authLoading } = useUserAuth()
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    console.log("Dashboard useEffect - user:", user, "authLoading:", authLoading)

    // Don't redirect while auth is still loading
    if (authLoading) {
      console.log("Auth still loading, waiting...")
      return
    }

    if (!user) {
      console.log("No user found, redirecting to login")
      router.push("/login")
      return
    }

    console.log("User found, fetching loan status")
    fetchLoanStatus()
  }, [user, authLoading, router])

  const fetchLoanStatus = async () => {
    try {
      const response = await apiClient.getUserLoans()
      if (response.success && response.data) {
        setLoans(response.data)
      }
    } catch (error) {
      console.error("Failed to fetch loan status:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-blue-500"
      case "repaid":
        return "bg-green-500"
      case "overdue":
        return "bg-red-500"
      case "defaulted":
        return "bg-gray-500"
      default:
        return "bg-gray-500"
    }
  }

  // Show loading while auth is being checked
  if (authLoading) {
    console.log("Dashboard render - auth loading, showing loading spinner")
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    console.log("Dashboard render - no user, returning null")
    return null
  }

  console.log("Dashboard render - user found, rendering dashboard")

  return (
    <>
      <ToastProvider />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-16">
          <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
            <p className="text-slate-600 dark:text-slate-300">
              Welcome back, {user?.username || 'User'}!
            </p>
          </div>
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Access your WiFi billing features</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button onClick={() => router.push("/packages")}>
              Browse Packages
            </Button>
            <Button variant="outline" onClick={() => router.push("/support")}>
              Get Support
            </Button>
          </CardContent>
        </Card>

        {/* Real-Time Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <LoanEligibilityStatus />
          <LoanNotificationCenter />
        </div>

        {/* Feedback Hub */}
        <FeedbackHub className="mb-8" />

        {/* Loan Status Dashboard */}
        <LoanStatusDashboard className="mb-8" />

        {/* Real-Time Messages */}
        <RealTimeLoanMessages className="mb-8" />

        {/* Legacy Loan Status (keeping for compatibility) */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              💰 Okoa Internet Loans
              <Badge variant="secondary">Beta</Badge>
            </CardTitle>
            <CardDescription>
              Borrow internet credit and repay later. Similar to Safaricom's Okoa Jahazi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading loan status...</div>
            ) : loans.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">No active loans</p>
                <LoanBorrowButton amount={30} onLoanSuccess={fetchLoanStatus} />
              </div>
            ) : (
              <div className="space-y-4">
                {loans.map((loan) => (
                  <div key={loan.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">Loan #{loan.id}</h3>
                        <p className="text-sm text-gray-600">
                          Borrowed: KES {loan.amount}
                        </p>
                      </div>
                      <Badge className={getStatusColor(loan.status)}>
                        {loan.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Borrowed:</span>{" "}
                        {new Date(loan.borrowedAt).toLocaleDateString()}
                      </div>
                      <div>
                        <span className="font-medium">Due:</span>{" "}
                        {new Date(loan.dueAt).toLocaleDateString()}
                      </div>
                      <div>
                        <span className="font-medium">Interest Rate:</span>{" "}
                        {(loan.interestRate * 100).toFixed(1)}%
                      </div>
                      <div>
                        <span className="font-medium">Total Due:</span> KES{" "}
                        {Math.round(loan.amount * (1 + loan.interestRate))}
                      </div>
                    </div>

                    {loan.status === "active" && (
                      <>
                        <Separator className="my-4" />
                        <div className="flex justify-between items-center">
                          <div className="text-sm text-gray-600">
                            Repay to continue borrowing
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              // TODO: Implement repay modal
                              toast({
                                title: "Repay Loan",
                                description: "Repayment functionality coming soon!",
                              })
                            }}
                          >
                            Repay Now
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                <Separator className="my-4" />

                {/* Borrow new loan if no active loans */}
                {loans.every((loan) => loan.status !== "active") && (
                  <div className="text-center">
                    <LoanBorrowButton amount={30} onLoanSuccess={fetchLoanStatus} />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-medium">Username:</span> {user?.username || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Phone:</span> {user?.phone || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Email:</span> {user?.email || 'Not set'}
              </div>
              <div>
                <span className="font-medium">Member since:</span>{" "}
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}
              </div>
            </div>
          </CardContent>
        </Card>
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}
