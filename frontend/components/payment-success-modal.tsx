"use client"

import { useState, useEffect } from "react"
import { CheckCircle, Wifi, Clock, Download, Share2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface PaymentSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  paymentData: {
    transactionId: string
    amount: number
    package: string
    phone: string
    mpesaRef: string
    expiresAt: string
    speed: string
  }
}

export function PaymentSuccessModal({ isOpen, onClose, paymentData }: PaymentSuccessModalProps) {
  const [timeLeft, setTimeLeft] = useState("")

  useEffect(() => {
    if (!paymentData.expiresAt) return

    const updateTimeLeft = () => {
      const now = new Date().getTime()
      const expiry = new Date(paymentData.expiresAt).getTime()
      const difference = expiry - now

      if (difference > 0) {
        const hours = Math.floor(difference / (1000 * 60 * 60))
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
        setTimeLeft(`${hours}h ${minutes}m`)
      } else {
        setTimeLeft("Expired")
      }
    }

    updateTimeLeft()
    const interval = setInterval(updateTimeLeft, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [paymentData.expiresAt])

  const handleDownloadReceipt = () => {
    // TODO: Integrate with backend to generate PDF receipt
    console.log("Download receipt for transaction:", paymentData.transactionId)
    // Backend endpoint: GET /api/receipts/${transactionId}
  }

  const handleShareConnection = () => {
    // TODO: Generate shareable connection details
    const shareText = `WiFi Access Details:\nPackage: ${paymentData.package}\nSpeed: ${paymentData.speed}\nExpires: ${paymentData.expiresAt}`

    if (navigator.share) {
      navigator.share({
        title: "WiFi Connection Details",
        text: shareText,
      })
    } else {
      navigator.clipboard.writeText(shareText)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
        <div className="relative">
          {/* Success Header */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-6 text-center text-white">
            <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
            <p className="text-green-100">You're now connected to the internet</p>
          </div>

          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Connection Details */}
          <div className="p-6 space-y-6">
            {/* Status Card */}
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500/10 rounded-full">
                      <Wifi className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">Connected</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{paymentData.speed} Speed</p>
                    </div>
                  </div>
                  <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                    Active
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Package Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-sm text-slate-600 dark:text-slate-400">Package</p>
                <p className="font-semibold text-slate-900 dark:text-white">{paymentData.package}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-sm text-slate-600 dark:text-slate-400">Amount Paid</p>
                <p className="font-semibold text-slate-900 dark:text-white">Ksh {paymentData.amount}</p>
              </div>
            </div>

            {/* Time Remaining */}
            <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20 border-orange-200 dark:border-orange-800/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-orange-500/10 rounded-full">
                      <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">Time Remaining</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Expires at {new Date(paymentData.expiresAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{timeLeft}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Transaction Details */}
            <div className="space-y-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-semibold text-slate-900 dark:text-white">Transaction Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Transaction ID:</span>
                  <span className="font-mono text-slate-900 dark:text-white">{paymentData.transactionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">M-Pesa Reference:</span>
                  <span className="font-mono text-slate-900 dark:text-white">{paymentData.mpesaRef}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Phone Number:</span>
                  <span className="text-slate-900 dark:text-white">{paymentData.phone}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <Button onClick={handleDownloadReceipt} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                <Download className="w-4 h-4 mr-2" />
                Download Receipt
              </Button>
              <Button onClick={handleShareConnection} variant="outline" className="flex-1 bg-transparent">
                <Share2 className="w-4 h-4 mr-2" />
                Share Details
              </Button>
            </div>

            {/* Footer Message */}
            <div className="text-center text-sm text-slate-600 dark:text-slate-400">
              <p>Enjoy your high-speed internet connection!</p>
              <p className="mt-1">Need help? Contact support at 0798750585</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
