"use client"

import { useState, useEffect } from "react"
import { CheckCircle, Clock, AlertTriangle, Phone, Package, Zap, Shield, Users, Globe, Star } from "lucide-react"
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
export default function UserPortal() {
  const { title } = useDynamicTitle("Get Connected Instantly")
  const [phone, setPhone] = useState("")
  const [amount, setAmount] = useState(30)
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [status, setStatus] = useState<"pending" | "completed" | "failed" | "">("")
  const [isLoading, setIsLoading] = useState(false)
  const [isLoanLoading, setIsLoanLoading] = useState(false)
  const [macAddress, setMacAddress] = useState("Loading...");
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [paymentData, setPaymentData] = useState<any>(null)

  useEffect(() => {
    fetchDeviceInfo()
  }, [])

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

     // ================= FIX 1 =================
  // Single source of truth for selected package
  const getSelectedPackage = () => {
    const pkg = packages.find((p) => p.value === amount)
    if (!pkg) {
      toast.error("Invalid package selected")
      return null
    }
    return pkg
  }

  const handlePayment = async () => {
    // ================= FIX 2 =================
    // Authentication guard
    const token = localStorage.getItem("user_token")
    if (!token) {
      window.location.href = "/login"
      return
    }

    if (!/^(07|01)\d{8}$/.test(phone)) {
      toast.error("Invalid phone number")
      return
    }

    // ================= FIX 3 =================
    // Correctly resolve selected package
    const selectedPackage = getSelectedPackage()
    if (!selectedPackage) return

    setIsLoading(true)
    setStatus("pending")

    toast.loading("Initiating M-Pesa payment...", {
      description: `${selectedPackage.price} for ${selectedPackage.label}`,
      id: "payment-loading",
    })

    try {
      const payload: PaymentRequest = {
        phone: `+254${phone.substring(1)}`,
        amount,
        package: selectedPackage.label,
        macAddress,
        speed: selectedPackage.speed,
      }

      const response = await apiClient.initiatePayment(payload)

      if (!response.success || !response.data) {
        throw new Error(response.error)
      }

      const { transactionId, status: paymentStatus, mpesaRef, expiresAt } = response.data
      setStatus(paymentStatus)

      if (paymentStatus === "completed") {
        setPaymentData({
          transactionId,
          amount,
          package: selectedPackage.label,
          phone: payload.phone,
          mpesaRef,
          expiresAt,
          speed: selectedPackage.speed,
        })

        toast.dismiss("payment-loading")
        toast.success("Payment successful")
        setTimeout(() => setShowSuccessModal(true), 1000)
      } else {
        pollPaymentStatus(transactionId)
      }
    } catch (err) {
      setStatus("failed")
      toast.dismiss("payment-loading")
      toast.error("Payment failed")
    } finally {
      setIsLoading(false)
    }
  }

  // ================= FIX 5 =================
// Handle Okoa Internet Loan
const handleLoan = async () => {
  if (!phone || !/^(07|01)\d{8}$/.test(phone)) {
    toast.error("Enter a valid phone number before requesting a loan")
    return
  }

  setIsLoanLoading(true)
  setStatus("pending")

  toast.loading("Requesting Okoa Internet loan...", { id: "loan-loading" })

  try {
    // Simulate API call for Okoa Internet loan
    const response = await apiClient.requestLoan({
      phone: `+254${phone.substring(1)}`,
      macAddress,
    })

    if (response.success && response.data?.loanApproved) {
      setStatus("completed")
      toast.dismiss("loan-loading")
      toast.success(`Loan approved! ${response.data.amount} Ksh credited to your account`)

      // Optionally show success modal
      setPaymentData({
        transactionId: response.data.transactionId,
        amount: response.data.amount,
        package: "Okoa Internet Loan",
        phone: `+254${phone.substring(1)}`,
        expiresAt: response.data.expiresAt,
      })
      setShowSuccessModal(true)
    } else {
      throw new Error(response.error || "Loan request failed")
    }
  } catch (error) {
    setStatus("failed")
    toast.dismiss("loan-loading")
    toast.error("Loan request failed. Please try again later.")
  } finally {
    setIsLoanLoading(false)
  }
}


  // ================= FIX 4 =================
  // Safe polling with package guard
  const pollPaymentStatus = async (txnId: string) => {
    let attempts = 0
    const maxAttempts = 30

    const poll = async () => {
      const selectedPackage = getSelectedPackage()
      if (!selectedPackage) return

      try {
        const response = await apiClient.checkPaymentStatus(txnId)
        if (response.success && response.data?.status === "completed") {
          setPaymentData({
            transactionId: txnId,
            amount,
            package: selectedPackage.label,
            phone: `+254${phone.substring(1)}`,
            mpesaRef: response.data.mpesaRef,
            expiresAt: response.data.expiresAt,
            speed: selectedPackage.speed,
          })
          setStatus("completed")
          toast.dismiss("payment-loading")
          toast.success("Payment successful")
          setShowSuccessModal(true)
          return
        }

        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000)
        } else {
          throw new Error("Timeout")
        }
      } catch {
        setStatus("failed")
        toast.dismiss("payment-loading")
        toast.error("Payment timeout or failed")
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

  return (
    <>
      <ToastProvider />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-16">
          <div className="max-w-4xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <h1 className="text-4xl lg:text-6xl font-bold text-slate-900 dark:text-white mb-4">
                Get Connected
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                  Instantly
                </span>
              </h1>
              <p className="text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
                Choose your internet package and pay securely with M-Pesa. Fast, reliable, and affordable internet
                access.
              </p>
            </div>

            <TrustIndicators />

            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Payment Form */}
              <Card className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-slate-900 dark:text-white flex items-center">
                    <Zap className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                    Quick Payment
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

                  {/* Package Selection */}
                  <div className="space-y-4">
                    <Label className="text-slate-700 dark:text-slate-300 flex items-center">
                      <Package className="w-4 h-4 mr-2" />
                      Select Package
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      {packages.map((pkg) => (
                        <PackageCard key={pkg.value} pkg={pkg} isSelected={amount === pkg.value} onSelect={setAmount} />
                      ))}
                    </div>
                  </div>

                  {/* Payment Buttons */}
                  <div className="flex gap-3">
                    <Button
                      onClick={handlePayment}
                      disabled={isLoading || !phone || phone.length !== 10}
                      className="flex-1 h-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold transition-all duration-300 disabled:opacity-50"
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

                    <Button
                      onClick={handleLoan}
                      disabled={isLoanLoading || isLoading || !phone || phone.length !== 10}
                      className="flex-1 h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold transition-all duration-300 disabled:opacity-50"
                    >
                      {isLoanLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          Processing loan...
                        </>
                      ) : (
                        <>
                          <Shield className="w-5 h-5 mr-2" />
                          Okoa Internet
                        </>
                      )}
                    </Button>
                  </div>

                  <StatusDisplay status={status} />
                </CardContent>
              </Card>

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
