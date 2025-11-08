"use client"

import { useState, useEffect } from "react"
import {
  Phone,
  Mail,
  MessageCircle,
  Clock,
  HelpCircle,
  Shield,
  CreditCard,
  Wifi,
  Search,
  ChevronDown,
  ChevronUp,
  Send,
  Users,
  User,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ToastProvider } from "@/components/toast-provider"
import { toast } from "sonner"
import { apiClient, wsClient } from "@/lib/api"
import { useDynamicTitle } from "@/hooks/use-dynamic-title"

const contactMethods = [
  {
    icon: Phone,
    title: "Phone Support",
    description: "Call us for immediate assistance",
    contact: "+254 700 000 000",
    availability: "24/7",
    color: "green",
  },
  {
    icon: Mail,
    title: "Email Support",
    description: "Send us your questions via email",
    contact: "support@qonnect.co.ke",
    availability: "Response within 2 hours",
    color: "blue",
  },
  {
    icon: MessageCircle,
    title: "Live Chat",
    description: "Chat with our support team",
    contact: "Available on website",
    availability: "Mon-Fri 8AM-8PM",
    color: "purple",
  },
]

const faqs = [
  {
    category: "Payment",
    icon: CreditCard,
    questions: [
      {
        question: "How do I pay for internet access?",
        answer:
          "You can pay using M-Pesa by selecting your desired package and following the payment prompts. Payment is instant and secure.",
      },
      {
        question: "What if my M-Pesa payment fails?",
        answer:
          "If your payment fails, please check your M-Pesa balance and try again. If the issue persists, contact our support team with your transaction details.",
      },
      {
        question: "Can I get a refund?",
        answer:
          "Refunds are processed on a case-by-case basis. Contact our support team within 24 hours of purchase for refund requests.",
      },
    ],
  },
  {
    category: "Connection",
    icon: Wifi,
    questions: [
      {
        question: "How do I connect to the WiFi?",
        answer:
          "After successful payment, you'll receive connection details. Select the Qonnect WiFi network and enter the provided credentials.",
      },
      {
        question: "Why is my internet slow?",
        answer:
          "Internet speed can be affected by network congestion, device limitations, or location. Try moving closer to the access point or contact support.",
      },
      {
        question: "Can I use multiple devices?",
        answer:
          "Yes, you can connect multiple devices with a single package. However, bandwidth is shared among all connected devices.",
      },
    ],
  },
  {
    category: "Account",
    icon: Shield,
    questions: [
      {
        question: "How do I check my remaining time?",
        answer:
          "Your remaining time is displayed on the connection portal. You can also check by visiting our website and entering your phone number.",
      },
      {
        question: "Can I extend my session?",
        answer:
          "Yes, you can purchase additional time before your current session expires. Simply select a new package and pay.",
      },
      {
        question: "What happens when my time expires?",
        answer:
          "When your time expires, your internet access will be automatically disconnected. You can purchase a new package to continue browsing.",
      },
    ],
  },
]

const FAQItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Card className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10">
      <CardContent className="p-0">
        <button
          className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="font-medium text-slate-900 dark:text-white">{question}</span>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>
        {isOpen && (
          <div className="px-4 pb-4">
            <p className="text-slate-600 dark:text-slate-400">{answer}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function SupportPage() {
  useDynamicTitle("Support")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [contactForm, setContactForm] = useState({
    name: "",
    phone: "",
    transactionCode: "",
    message: "",
  })
  const [userRequests, setUserRequests] = useState<any[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [viewRequestsPhone, setViewRequestsPhone] = useState("")
  const [showRequestViewer, setShowRequestViewer] = useState(false)

  // Check authentication and load user requests
  useEffect(() => {
    const token = localStorage.getItem('user_token')
    const userData = localStorage.getItem('user_data')
    if (token && userData) {
      setIsAuthenticated(true)
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
      loadUserRequests(parsedUser.phone)
      // Connect to WebSocket for real-time updates
      wsClient.connect(parsedUser.phone)
    }
  }, [])

  // WebSocket connection status and real-time updates
  useEffect(() => {
    const handleWsMessage = (event: CustomEvent) => {
      const data = event.detail
      if (data.type === "status_update" || data.type === "new_request") {
        // Refresh user requests when we get a real-time update
        if (user?.phone) {
          loadUserRequests(user.phone)
        }
        // Also refresh the viewer if it's showing the same phone
        if (showRequestViewer && viewRequestsPhone && viewRequestsPhone === user?.phone) {
          loadUserRequests(viewRequestsPhone)
        }
      }
    }

    const handleWsConnection = (event: CustomEvent) => {
      setWsConnected(event.detail.connected)
    }

    window.addEventListener("support_request_update", handleWsMessage as EventListener)
    window.addEventListener("websocket_connected", handleWsConnection as EventListener)

    return () => {
      window.removeEventListener("support_request_update", handleWsMessage as EventListener)
      window.removeEventListener("websocket_connected", handleWsConnection as EventListener)
    }
  }, [user?.phone, showRequestViewer, viewRequestsPhone])

  // Auto-refresh user requests every 5 seconds when authenticated (fallback)
  useEffect(() => {
    if (!isAuthenticated || !user?.phone) return

    const interval = setInterval(() => {
      loadUserRequests(user.phone)
    }, 5000) // 5 seconds for near real-time updates

    return () => clearInterval(interval)
  }, [isAuthenticated, user?.phone])

  // Store requests in localStorage for persistence
  useEffect(() => {
    if (userRequests.length > 0 && user?.phone) {
      const storageKey = `support_requests_${user.phone}`
      localStorage.setItem(storageKey, JSON.stringify(userRequests))
    }
  }, [userRequests, user?.phone])

  // Load cached requests on mount
  useEffect(() => {
    if (isAuthenticated && user?.phone) {
      const storageKey = `support_requests_${user.phone}`
      const cached = localStorage.getItem(storageKey)
      if (cached) {
        try {
          const parsedRequests = JSON.parse(cached)
          setUserRequests(parsedRequests)
        } catch (error) {
          console.error("Error parsing cached requests:", error)
        }
      }
    }
  }, [isAuthenticated, user?.phone])

  const loadUserRequests = async (phone: string) => {
    if (!phone) return

    setLoadingRequests(true)
    try {
      const response = await apiClient.getUserSupportRequests(phone)
      if (response.success && response.data) {
        // Server data takes precedence - this is the source of truth
        const serverRequests = response.data

        // Update state with server data
        setUserRequests(serverRequests)

        // Update cache with latest server data
        const storageKey = `support_requests_${phone}`
        localStorage.setItem(storageKey, JSON.stringify(serverRequests))

        console.log(`Updated ${serverRequests.length} support requests for user ${phone}`)
      } else {
        throw new Error(response.error || "Failed to fetch requests")
      }
    } catch (error) {
      console.error("Error loading user requests:", error)
      // On error, try to load from cache as fallback
      const storageKey = `support_requests_${phone}`
      const cached = localStorage.getItem(storageKey)
      if (cached) {
        try {
          const cachedRequests = JSON.parse(cached)
          setUserRequests(cachedRequests)
          console.log(`Loaded ${cachedRequests.length} cached requests as fallback`)
        } catch (cacheError) {
          console.error("Error loading cached requests:", cacheError)
        }
      }
    } finally {
      setLoadingRequests(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400", label: "Pending" },
      in_progress: { color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", label: "In Progress" },
      resolved: { color: "bg-green-500/10 text-green-600 dark:text-green-400", label: "Resolved" },
      closed: { color: "bg-gray-500/10 text-gray-600 dark:text-gray-400", label: "Closed" },
    } as const
    type StatusKey = keyof typeof statusConfig
    const config = statusConfig[status as StatusKey] || statusConfig.pending
    return <Badge className={`${config.color} border-0`}>{config.label}</Badge>
  }

  const filteredFAQs = faqs.filter((category) => {
    if (selectedCategory !== "all" && category.category.toLowerCase() !== selectedCategory) {
      return false
    }
    if (searchTerm) {
      return category.questions.some(
        (q) =>
          q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.answer.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }
    return true
  })

  const handleContactSubmit = async (e) => {
    e.preventDefault()
    toast.loading("Sending your message...", { id: "contact-form" })

    try {
      const response = await apiClient.submitSupportRequest(contactForm)

      if (response.success) {
        toast.success("Message sent successfully!", {
          id: "contact-form",
          description: "We'll get back to you within 2 hours",
        })
        setContactForm({
          name: "",
          phone: "",
          transactionCode: "",
          message: "",
        })
        // Refresh user requests if authenticated
        if (isAuthenticated && user?.phone) {
          loadUserRequests(user.phone)
        }
      } else {
        throw new Error(response.error || "Failed to send message")
      }
    } catch (error: any) {
      toast.error("Failed to send message", {
        id: "contact-form",
        description: error.message || "Please try again later",
      })
    }
  }

  const handleInputChange = (field, value) => {
    setContactForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <>
      <ToastProvider />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <Header />

        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-16">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-8">
              <HelpCircle className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold text-slate-900 dark:text-white mb-6">
              How Can We
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                Help You?
              </span>
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-3xl mx-auto">
              Get instant support for all your WiFi and payment questions. Our team is here to help you 24/7.
            </p>
          </div>

          {/* Support Request Viewer - For all users */}
          <div className="max-w-4xl mx-auto mb-16">
            <Card className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10">
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white flex items-center justify-between">
                  <span>View Support Requests</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {wsConnected ? 'Real-time' : 'Polling'}
                    </span>
                  </div>
                </CardTitle>
                <div className="flex gap-2 mt-4">
                  <Input
                    placeholder="Enter phone number to view requests..."
                    value={viewRequestsPhone}
                    onChange={(e) => setViewRequestsPhone(e.target.value)}
                    className="bg-white/50 dark:bg-slate-700/50 border-slate-300 dark:border-white/10"
                  />
                  <Button
                    onClick={() => {
                      if (viewRequestsPhone.trim()) {
                        loadUserRequests(viewRequestsPhone.trim())
                        setShowRequestViewer(!showRequestViewer)
                      }
                    }}
                    variant={showRequestViewer ? "default" : "outline"}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!viewRequestsPhone.trim()}
                  >
                    {showRequestViewer ? 'Hide' : 'View'} Requests
                  </Button>
                </div>
              </CardHeader>
              {showRequestViewer && (
                <CardContent>
                  {loadingRequests ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Loading requests...</p>
                    </div>
                  ) : userRequests.length > 0 ? (
                    <div className="space-y-4">
                      {userRequests
                        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((request: any) => (
                        <div key={request.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 hover:shadow-md transition-shadow">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-medium text-slate-900 dark:text-white">{request.name}</h4>
                              {getStatusBadge(request.status)}
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{request.message}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500">
                              Transaction: {request.transactionCode} • {new Date(request.createdAt).toLocaleDateString()} • {new Date(request.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-400 dark:text-slate-500">ID: {request.id}</p>
                          </div>
                        </div>
                      ))}
                      <div className="text-center mt-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Status updates automatically • {wsConnected ? 'Real-time updates active' : 'Updates every 5 seconds'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-slate-600 dark:text-slate-400 mb-2">
                        No support requests found for this phone number.
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        Enter a phone number above to view associated support requests.
                      </p>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </div>

          {/* User Support Requests - Show for authenticated users */}
          {isAuthenticated && (
            <div className="max-w-4xl mx-auto mb-16">
              <Card className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10">
                <CardHeader>
                  <CardTitle className="text-slate-900 dark:text-white">
                    Your Support Requests ({userRequests.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userRequests.length > 0 ? (
                    <div className="space-y-4">
                      {userRequests
                        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((request: any) => (
                        <div key={request.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 hover:shadow-md transition-shadow">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-medium text-slate-900 dark:text-white">{request.name}</h4>
                              {getStatusBadge(request.status)}
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{request.message}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500">
                              Transaction: {request.transactionCode} • {new Date(request.createdAt).toLocaleDateString()} • {new Date(request.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-400 dark:text-slate-500">ID: {request.id}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-slate-600 dark:text-slate-400 mb-2">
                        You haven't submitted any support requests yet.
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500">
                        Submit a request below and it will appear here with real-time status updates.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Contact Form - Moved to Top */}
          <div className="max-w-2xl mx-auto mb-16" id="contact">
            <Card className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10">
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white text-center">
                  Need Help? Contact Us
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleContactSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">
                        Full Name
                      </Label>
                      <Input
                        id="name"
                        value={contactForm.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        className="bg-white/50 dark:bg-slate-700/50 border-slate-300 dark:border-white/10"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-slate-700 dark:text-slate-300">
                        Phone Number
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={contactForm.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        className="bg-white/50 dark:bg-slate-700/50 border-slate-300 dark:border-white/10"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="transactionCode" className="text-slate-700 dark:text-slate-300">
                      Transaction Code
                    </Label>
                    <Input
                      id="transactionCode"
                      value={contactForm.transactionCode}
                      onChange={(e) => handleInputChange("transactionCode", e.target.value)}
                      className="bg-white/50 dark:bg-slate-700/50 border-slate-300 dark:border-white/10"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="message" className="text-slate-700 dark:text-slate-300">
                      Message
                    </Label>
                    <Textarea
                      id="message"
                      rows={5}
                      value={contactForm.message}
                      onChange={(e) => handleInputChange("message", e.target.value)}
                      className="bg-white/50 dark:bg-slate-700/50 border-slate-300 dark:border-white/10"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Submit
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Contact Methods */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {contactMethods.map((method, index) => (
              <Card
                key={index}
                className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 text-center hover:scale-105 transition-transform"
              >
                <CardContent className="p-6">
                  <div
                    className={`mx-auto w-16 h-16 rounded-full bg-${method.color}-500/10 flex items-center justify-center mb-4`}
                  >
                    <method.icon className={`w-8 h-8 text-${method.color}-600 dark:text-${method.color}-400`} />
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{method.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-3">{method.description}</p>
                  <div className="font-medium text-slate-900 dark:text-white mb-2">{method.contact}</div>
                  <Badge
                    variant="outline"
                    className={`text-${method.color}-600 dark:text-${method.color}-400 border-${method.color}-600 dark:border-${method.color}-400`}
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    {method.availability}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-8">
              Frequently Asked Questions
            </h2>

            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8 max-w-2xl mx-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search FAQs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-white/10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory("all")}
                  className="bg-transparent"
                >
                  All
                </Button>
                {faqs.map((category) => (
                  <Button
                    key={category.category}
                    variant={selectedCategory === category.category.toLowerCase() ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category.category.toLowerCase())}
                    className="bg-transparent"
                  >
                    <category.icon className="w-4 h-4 mr-1" />
                    {category.category}
                  </Button>
                ))}
              </div>
            </div>

            {/* FAQ Items */}
            <div className="max-w-4xl mx-auto">
              {filteredFAQs.map((category) => (
                <div key={category.category} className="mb-8">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
                    <category.icon className="w-5 h-5 mr-2" />
                    {category.category}
                  </h3>
                  <div className="space-y-3">
                    {category.questions.map((faq, index) => (
                      <FAQItem key={index} question={faq.question} answer={faq.answer} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Emergency Support */}
          <div className="text-center mt-16">
            <Card className="bg-gradient-to-r from-red-500 to-orange-500 border-0 text-white max-w-2xl mx-auto">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold mb-4">Emergency Support</h3>
                <p className="mb-6 opacity-90">
                  Having critical connectivity issues? Our emergency support team is available 24/7.
                </p>
                <Button className="bg-white text-red-600 hover:bg-slate-100 font-semibold px-8 py-3">
                  <Phone className="w-4 h-4 mr-2" />
                  Call Emergency Support
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>

        <Footer />
      </div>
    </>
  )
}
