"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Wifi, Eye, EyeOff, User, Mail, Phone, Lock } from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"
import { useDynamicTitle } from "@/hooks/use-dynamic-title"

export default function LoginPage() {
  useDynamicTitle("Login")
  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  })
  const [registerData, setRegisterData] = useState({
    username: "testuser",
    email: "",
    phone: "0712345678",
    password: "Test12",
    confirmPassword: "Test12",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const validatePassword = (password: string) => {
    // 6 digits, combination of numbers and alphabets
    const hasNumber = /\d/.test(password)
    const hasLetter = /[a-zA-Z]/.test(password)
    const isLengthValid = password.length === 6

    return hasNumber && hasLetter && isLengthValid
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      console.log("Attempting login with:", loginData)
      const response = await apiClient.login(loginData)
      console.log("Login response:", response)

      if (response.success && response.data) {
        console.log("Login successful, storing data and redirecting")
        localStorage.setItem('user_token', response.data.token)
        localStorage.setItem('user_data', JSON.stringify(response.data.user))
        toast.success("Login successful!")

        // Force a page reload to ensure auth state is updated
        window.location.href = "/dashboard"
      } else {
        throw new Error(response.error || "Invalid credentials")
      }
    } catch (error) {
      console.error("Login error:", error)
      setError("Invalid credentials")
      toast.error("Invalid credentials")
    } finally {
      setLoading(false)
    }
  }


  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validation
    if (!registerData.username || !registerData.phone || !registerData.password) {
      setError("Username, phone, and password are required")
      toast.error("Please fill in all required fields")
      setLoading(false)
      return
    }

    if (!validatePassword(registerData.password)) {
      setError("Password must be exactly 6 characters with both numbers and letters")
      toast.error("Invalid password format")
      setLoading(false)
      return
    }

    if (registerData.password !== registerData.confirmPassword) {
      setError("Passwords do not match")
      toast.error("Passwords do not match")
      setLoading(false)
      return
    }

    // Phone validation (Kenyan format)
    const phoneRegex = /^(\+254|254|0)[17]\d{8}$/
    if (!phoneRegex.test(registerData.phone)) {
      setError("Invalid phone number format")
      toast.error("Invalid phone number format")
      setLoading(false)
      return
    }

    try {
      console.log("Attempting registration with:", registerData)
      const response = await apiClient.register(registerData)
      console.log("Registration response:", response)

      if (response.success && response.data) {
        console.log("Registration successful, storing data and redirecting")
        localStorage.setItem('user_token', response.data.token)
        localStorage.setItem('user_data', JSON.stringify(response.data.user))
        toast.success("Account created successfully! Data transferred to database.")

        // Force a page reload to ensure auth state is updated
        window.location.href = "/dashboard"
      } else {
        throw new Error(response.error || "Registration failed")
      }
    } catch (error) {
      console.error("Registration error:", error)
      setError("Registration failed")
      toast.error("Registration failed")
    } finally {
      setLoading(false)
    }
  }

  const handleLoginInputChange = (field: string, value: string) => {
    setLoginData((prev) => ({ ...prev, [field]: value }))
  }

  const handleRegisterInputChange = (field: string, value: string) => {
    setRegisterData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <Wifi className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Welcome to Qonnect WiFi</CardTitle>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Sign in to your account or create a new one
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="login-username"
                      type="text"
                      placeholder="Enter your username"
                      value={loginData.username}
                      onChange={(e) => handleLoginInputChange("username", e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={loginData.password}
                      onChange={(e) => handleLoginInputChange("password", e.target.value)}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {error && (
                  <div className="text-red-500 text-sm text-center" role="alert">{error}</div>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-username">Username *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="register-username"
                      type="text"
                      placeholder="Choose a username"
                      value={registerData.username}
                      onChange={(e) => handleRegisterInputChange("username", e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email (Optional)</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="your@email.com"
                      value={registerData.email}
                      onChange={(e) => handleRegisterInputChange("email", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-phone">Phone Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="register-phone"
                      type="tel"
                      placeholder="0712345678"
                      value={registerData.phone}
                      onChange={(e) => handleRegisterInputChange("phone", e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password *</Label>
                  <div className="relative">
                    <Input
                      id="register-password"
                      type={showRegisterPassword ? "text" : "password"}
                      placeholder="6-digit combo (e.g., Ab1234)"
                      value={registerData.password}
                      onChange={(e) => handleRegisterInputChange("password", e.target.value)}
                      className="pr-10"
                      maxLength={6}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">Must be exactly 6 characters with both letters and numbers</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-confirm-password">Confirm Password *</Label>
                  <div className="relative">
                    <Input
                      id="register-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={registerData.confirmPassword}
                      onChange={(e) => handleRegisterInputChange("confirmPassword", e.target.value)}
                      className="pr-10"
                      maxLength={6}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {error && (
                  <div className="text-red-500 text-sm text-center" role="alert">{error}</div>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Creating Account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}