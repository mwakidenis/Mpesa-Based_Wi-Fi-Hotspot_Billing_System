"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, Clock, AlertTriangle, Phone, Package, Zap, Shield, Users, Globe, Star, CreditCard, Wifi } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { PaymentSuccessModal } from "@/components/payment-success-modal"
import { ToastProvider } from "@/components/toast-provider"
import { toast } from "sonner"
import { apiClient, type PaymentRequest } from "@/lib/api"
import { useDynamicTitle } from "@/hooks/use-dynamic-title"
import TrustIndicators from "@/components/TrustIndicators"
import PackageCard from "@/components/PackageCard"
import StatusDisplay from "@/components/StatusDisplay"
import DeviceInfoPanel from "@/components/DeviceInfoPanel"
import InfoPanel from "@/components/InfoPanel"
import LoanBorrowButton from "@/components/LoanBorrowButton"

// --- Constants ---
const packages: {
  label: string;
  value: number;
  price: string;
  speed: string;
  color: "blue" | "purple" | "green" | "yellow";
  popular: boolean;
}[] = [
  { label: "24 Hours", value: 30, price: "Ksh 30", speed: "5 Mbps", color: "blue", popular: true },
  { label: "12 Hours", value: 20, price: "Ksh 20", speed: "4 Mbps", color: "purple", popular: false },
  { label: "4 Hours", value: 15, price: "Ksh 15", speed: "3 Mbps", color: "green", popular: false },
  { label: "1 Hour", value: 10, price: "Ksh 10", speed: "2 Mbps", color: "yellow", popular: false },
]

// --- Main Component ---
export default function PackagesPage() {
  const { title } = useDynamicTitle("Internet Packages")
  const [phone, setPhone] = useState("")
  const [amount, setAmount] = useState(30)
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [status, setStatus] = useState<"pending" | "completed" | "failed" | "">("")
  const [isLoading, setIsLoading] = useState(false)
  const [macAddress, setMacAddress] = useState("Loading...")
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [paymentData, setPaymentData] = useState<any>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('user_token')
    if (!token) {
      router.push('/login')
      return
    }
    setIsAuthenticated(true)

    fetchDeviceInfo()
  }, [router])

  const fetchDeviceInfo = async () => {
    try {
      toast.info("Fetching device information...", { duration: 2000 })

      const response = await apiClient.getDeviceInfo()

      if (response.success && response.data) {
        setMacAddress(response.data.macAddress)
        toast.success("Device information loaded", { duration: 2000 })
      } else {
        throw new Error(response.error || "Failed to fetch device info")
      }
    } catch (error) {
      console.error("Error fetching device info:", error)
      setMacAddress("UNAVAILABLE")
      toast.error("Could not retrieve device information", {
        description: "Please check your network connection and refresh the page",
      })
    }
  }

  const handlePayment = async () => {
    // Validation
    if (!/^(07|01)\d{8}$/.test(phone)) {
      toast.error("Invalid phone number", {
        description: "Please enter a valid 10-digit phone number starting with 07 or 01",
      })
      return
    }

    if (!amount) {
      toast.error("No package selected", {
        description: "Please select a package before proceeding",
      })
      return
    }

    const selectedPackage = packages.find((p) => p.value === amount)
    if (!selectedPackage) {
      toast.error("Invalid package selected")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setStatus("pending")

    toast.loading("Initiating M-Pesa payment...", {
      description: `${selectedPackage.price} for ${selectedPackage.label}`,
      id: "payment-loading",
    })

    try {
      const paymentPayload: PaymentRequest = {
        phone: `+254${phone.substring(1)}`,
        amount,
        package: selectedPackage.label,
        macAddress,
        speed: selectedPackage.speed,
      }

      console.log("Payment payload:", paymentPayload)

      const response = await apiClient.initiatePayment(paymentPayload)

      if (response.success && response.data) {
        const { transactionId: txnId, mpesaRef, status: paymentStatus, expiresAt } = response.data

        setTransactionId(txnId)
        setStatus(paymentStatus)

        if (paymentStatus === "completed") {
          const successPaymentData = {
            transactionId: txnId,
            amount,
            package: selectedPackage.label,
            phone: `+254${phone.substring(1)}`,
            mpesaRef,
            expiresAt,
            speed: selectedPackage.speed,
          }

          setPaymentData(successPaymentData)

          toast.dismiss("payment-loading")
          toast.success("Payment successful!", {
            description: "You are now connected to the internet",
            duration: 4000,
          })

          setTimeout(() => {
            setShowSuccessModal(true)
          }, 1000)
        } else if (paymentStatus === "pending") {
          // Poll for payment status
          pollPaymentStatus(txnId)
        }
      } else {
        throw new Error(response.error || "Payment initiation failed")
      }
    } catch (error) {
      setStatus("failed")
      toast.dismiss("payment-loading")
      const errMsg = error instanceof Error ? error.message : String(error)
      toast.error("Payment error", {
        description: errMsg || "An unexpected error occurred. Please try again.",
        duration: 4000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const pollPaymentStatus = async (txnId: string) => {
    const maxAttempts = 30 // 5 minutes with 10-second intervals
    let attempts = 0

    const poll = async () => {
      try {
        const response = await apiClient.checkPaymentStatus(txnId)

        if (response.success && response.data) {
          const { status: paymentStatus, mpesaRef, expiresAt } = response.data

          if (paymentStatus === "completed") {
            const selectedPackage = packages.find((p) => p.value === amount)
            const successPaymentData = {
              transactionId: txnId,
              amount,
              package: selectedPackage.label,
              phone: `+254${phone.substring(1)}`,
              mpesaRef,
              expiresAt,
              speed: selectedPackage.speed,
            }

            setPaymentData(successPaymentData)
            setStatus("completed")

            toast.dismiss("payment-loading")
            toast.success("Payment successful!", {
              description: "You are now connected to the internet",
              duration: 4000,
            })

            setTimeout(() => {
              setShowSuccessModal(true)
            }, 1000)
            return
          } else if (paymentStatus === "failed") {
            setStatus("failed")
            toast.dismiss("payment-loading")
            toast.error("Payment failed", {
              description: "Please check your M-Pesa balance and try again",
              duration: 4000,
            })
            return
          }
        }

        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000) // Poll every 10 seconds
        } else {
          setStatus("failed")
          toast.dismiss("payment-loading")
          toast.error("Payment timeout", {
            description: "Payment is taking longer than expected. Please contact support.",
            duration: 4000,
          })
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        console.error("Error polling payment status:", errMsg)
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000)
        }
      }
    }

    poll()
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPhone(value)

    // Real-time validation feedback
    if (value && !/^(07|01)\d{0,8}$/.test(value)) {
      toast.error("Invalid format", {
        description: "Phone number should start with 07 or 01",
        duration: 2000,
      })
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <>
      <ToastProvider />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-16">
          <div className="max-w-4xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-8">
                <Package className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-4xl lg:text-6xl font-bold text-slate-900 dark:text-white mb-6">
                Choose Your
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                  Internet Package
                </span>
              </h1>
              <p className="text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
                Select the perfect package for your internet needs. Fast, reliable, and affordable connectivity.
              </p>
            </div>

            <TrustIndicators />

            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Package Selection */}
              <div className="space-y-6">
                <Card className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10">
                  <CardHeader>
                    <CardTitle className="text-slate-900 dark:text-white flex items-center">
                      <Package className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                      Available Packages
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {packages.map((pkg) => (
                        <PackageCard key={pkg.value} pkg={pkg} isSelected={amount === pkg.value} onSelect={setAmount} />
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Form */}
                <Card className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-slate-900 dark:text-white flex items-center">
                      <Zap className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                      Payment Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Phone Input */}
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-slate-700 dark:text-slate-300 flex items-center">
                        <Phone className="w-4 h-4 mr-2" />
                        M-Pesa Number
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="0712 345 678"
                        value={phone}
                        onChange={handlePhoneChange}
                        className="bg-white/50 dark:bg-slate-700/50 border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:border-blue-500 dark:focus:border-blue-400"
                        maxLength={10}
                      />
                    </div>

                    {/* Payment Button */}
                    <Button
                      onClick={handlePayment}
                      disabled={isLoading || !phone || phone.length !== 10}
                      className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold transition-all duration-300 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5 mr-2" />
                          Pay with M-Pesa - {packages.find((p) => p.value === amount)?.price}
                        </>
                      )}
                    </Button>

                    {/* Okoa Internet Loan Button */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 text-center">
                        Don't have enough? Try Okoa Internet!
                      </p>
                      <LoanBorrowButton
                        amount={amount}
                        onLoanSuccess={(loanData) => {
                          toast.success("Loan approved!", {
                            description: `You borrowed Ksh ${loanData.amount}. Repay by ${new Date(loanData.dueAt).toLocaleDateString()}`
                          })
                        }}
                      />
                    </div>

                    <StatusDisplay status={status} />
                  </CardContent>
                </Card>
              </div>

              {/* Info Panel */}
              <div className="space-y-6">
                <InfoPanel />
                <DeviceInfoPanel macAddress={macAddress} status={status} />
              </div>
            </div>
          </div>
        </main>
        <Footer />
        {/* Success Modal */}
        {paymentData && (
          <PaymentSuccessModal
            isOpen={showSuccessModal}
            onClose={() => setShowSuccessModal(false)}
            paymentData={paymentData}
          />
        )}
      </div>
    </>
  )
}
