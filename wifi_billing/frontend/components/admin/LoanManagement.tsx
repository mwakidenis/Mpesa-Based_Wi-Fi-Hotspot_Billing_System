"use client"

import { useState, useEffect } from "react"
import { Search, Download, Eye, RefreshCw, DollarSign, TrendingUp, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"

interface Loan {
  id: number
  userId: number
  amount: number
  status: "active" | "repaid" | "overdue" | "defaulted"
  borrowedAt: string
  dueAt: string
  repaidAt?: string
  repaymentAmount?: number
  interestRate: number
  createdAt: string
  updatedAt: string
  user: {
    username: string
    phone: string
  }
}

interface LoanStats {
  totalLoans: number
  activeLoans: number
  totalAmount: number
  repaidAmount: number
  overdueLoans: number
  defaultedLoans: number
}

export default function LoanManagement() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [stats, setStats] = useState<LoanStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  useEffect(() => {
    fetchLoans()
    fetchStats()
  }, [])

  const fetchLoans = async () => {
    try {
      const response = await apiClient.getAllLoans()
      if (response.success && response.data) {
        setLoans(response.data)
      }
    } catch (error) {
      console.error("Error fetching loans:", error)
      toast.error("Failed to fetch loans")
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      // Calculate stats from loans data
      const response = await apiClient.getAllLoans()
      if (response.success && response.data) {
        const loansData = response.data
        const stats = {
          totalLoans: loansData.length,
          activeLoans: loansData.filter(l => l.status === 'active').length,
          totalAmount: loansData.reduce((sum, l) => sum + l.amount, 0),
          repaidAmount: loansData
            .filter(l => l.status === 'repaid')
            .reduce((sum, l) => sum + (l.repaymentAmount || 0), 0),
          overdueLoans: loansData.filter(l => l.status === 'overdue').length,
          defaultedLoans: loansData.filter(l => l.status === 'defaulted').length,
        }
        setStats(stats)
      }
    } catch (error) {
      console.error("Error fetching loan stats:", error)
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

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString()}`
  }

  const exportLoans = () => {
    const csvContent = [
      ["ID", "Username", "Phone", "Amount", "Status", "Borrowed At", "Due At", "Repaid At", "Repayment Amount"],
      ...filteredLoans.map(loan => [
        loan.id,
        loan.user.username,
        loan.user.phone,
        loan.amount,
        loan.status,
        new Date(loan.borrowedAt).toLocaleDateString(),
        new Date(loan.dueAt).toLocaleDateString(),
        loan.repaidAt ? new Date(loan.repaidAt).toLocaleDateString() : "",
        loan.repaymentAmount || ""
      ])
    ].map(row => row.join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `loans_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Loans</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalLoans || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeLoans || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalAmount || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Loans</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.overdueLoans || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Loan Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="repaid">Repaid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="defaulted">Defaulted</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportLoans} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={() => { fetchLoans(); fetchStats(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Loans Table */}
          <div className="rounded-md border">
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
                        <div className="font-medium">{loan.user.username}</div>
                        <div className="text-sm text-muted-foreground">{loan.user.phone}</div>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(loan.amount)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(loan.status)}>
                        {loan.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(loan.borrowedAt).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(loan.dueAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              toast.info("Loan Details", {
                                description: `Loan #${loan.id} - ${formatCurrency(loan.amount)} - Status: ${loan.status}`,
                              })
                            }}
                          >
                            View Details
                          </DropdownMenuItem>
                          {loan.status === 'active' && (
                            <DropdownMenuItem
                              onClick={() => {
                                toast.info("Mark as Overdue", {
                                  description: "This would mark the loan as overdue",
                                })
                              }}
                            >
                              Mark as Overdue
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredLoans.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No loans found matching your criteria.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
