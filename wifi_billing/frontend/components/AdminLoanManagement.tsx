"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CreditCard,
  Users,
  TrendingUp,
  DollarSign,
  RefreshCw,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react"
import { toast } from "sonner"
import { apiClient, Loan } from "@/lib/api"

interface AdminLoanManagementProps {
  className?: string
}

export default function AdminLoanManagement({ className }: AdminLoanManagementProps) {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [bypassForm, setBypassForm] = useState({
    userId: "",
    amount: ""
  })

  useEffect(() => {
    loadLoans()
  }, [])

  const loadLoans = async () => {
    try {
      const response = await apiClient.getAllLoans({
        status: statusFilter !== "all" ? statusFilter : undefined
      })
      if (response.success && response.data) {
        setLoans(response.data)
      }
    } catch (error) {
      console.error("Error loading loans:", error)
      toast.error("Failed to load loans")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadLoans()
  }

  const handleStatusChange = async (loanId: number, newStatus: string) => {
    try {
      const response = await apiClient.updateLoanStatus(loanId, newStatus)
      if (response.success) {
        toast.success("Loan status updated successfully")
        await loadLoans()
      } else {
        toast.error("Failed to update loan status")
      }
    } catch (error) {
      console.error("Error updating loan status:", error)
      toast.error("Failed to update loan status")
    }
  }

  const handleCreateBypassLoan = async () => {
    if (!bypassForm.userId || !bypassForm.amount) {
      toast.error("Please fill in all fields")
      return
    }

    try {
      const response = await apiClient.createBypassLoan(
        parseInt(bypassForm.userId),
        parseInt(bypassForm.amount)
      )
      if (response.success) {
        toast.success("Bypass loan created successfully")
        setShowCreateDialog(false)
        setBypassForm({ userId: "", amount: "" })
        await loadLoans()
      } else {
        toast.error("Failed to create bypass loan")
      }
    } catch (error) {
      console.error("Error creating bypass loan:", error)
      toast.error("Failed to create bypass loan")
    }
  }

  const filteredLoans = loans.filter(loan => {
    const matchesSearch = loan.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         loan.user.phone.includes(searchTerm)
    const matchesStatus = statusFilter === "all" || loan.status === statusFilter
    return matchesSearch && matchesStatus
  })

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

  const totalLoans = loans.length
  const activeLoans = loans.filter(l => l.status === 'active').length
  const totalAmount = loans.reduce((sum, loan) => sum + loan.amount, 0)
  const repaidAmount = loans
    .filter(l => l.status === 'repaid')
    .reduce((sum, loan) => sum + (loan.repaymentAmount || 0), 0)

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Loading loan management...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Loan Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Loans</p>
                <p className="text-2xl font-bold">{totalLoans}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Active Loans</p>
                <p className="text-2xl font-bold">{activeLoans}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold">Ksh {totalAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Repaid Amount</p>
                <p className="text-2xl font-bold">Ksh {repaidAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loan Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center">
            <CreditCard className="w-5 h-5 mr-2" />
            Loan Management
          </CardTitle>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Bypass Loan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Bypass Loan</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="userId">User ID</Label>
                    <Input
                      id="userId"
                      type="number"
                      placeholder="Enter user ID"
                      value={bypassForm.userId}
                      onChange={(e) => setBypassForm(prev => ({ ...prev, userId: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="amount">Loan Amount (KES)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="Enter loan amount"
                      value={bypassForm.amount}
                      onChange={(e) => setBypassForm(prev => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateBypassLoan}>
                      Create Loan
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by username or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="repaid">Repaid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="defaulted">Defaulted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Loans Table */}
          {filteredLoans.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No loans found</p>
              <p className="text-sm">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Borrowed</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLoans.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">#{loan.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{loan.user.username}</p>
                          <p className="text-sm text-gray-500">{loan.user.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>Ksh {loan.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(loan.status)} text-white`}>
                          <span className="flex items-center">
                            {getStatusIcon(loan.status)}
                            <span className="ml-1">
                              {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                            </span>
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(loan.borrowedAt).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(loan.dueAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Select
                          value={loan.status}
                          onValueChange={(value) => handleStatusChange(loan.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="repaid">Repaid</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                            <SelectItem value="defaulted">Defaulted</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}