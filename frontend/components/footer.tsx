"use client"

import { Wifi, Shield } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-slate-200/20 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <Wifi className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900 dark:text-white">Invoicify Pro</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs">
              Providing fast, reliable internet access with seamless M-Pesa integration for easy payments.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Quick Links</h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>
                <Link href="/packages" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Packages
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Support
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Admin
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Support</h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>
                <Link href="/support#help" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/support#contact" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/support#terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/support#privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Contact</h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>Email: support@invoicifydenis.co.ke</li>
              <li>Phone: +254 700 000 000</li>
              <li>Available 24/7</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-200/20 dark:border-white/10 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">© 2024 Invoicify Pro. All rights reserved.</p>
          <div className="flex items-center space-x-4 mt-4 sm:mt-0">
            <Badge
              variant="outline"
              className="text-green-600 dark:text-green-400 border-green-600 dark:border-green-400"
            >
              <Shield className="w-3 h-3 mr-1" />
              Secure Payments
            </Badge>
          </div>
        </div>
      </div>
    </footer>
  )
}
