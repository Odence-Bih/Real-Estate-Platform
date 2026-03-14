import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ProtectedAdminRoute from './components/ProtectedAdminRoute'
import AdminLayout from './components/layout/AdminLayout'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Verify from './pages/Verify'
import CreateListing from './pages/CreateListing'
import Listings from './pages/Listings'
import ListingDetail from './pages/ListingDetail'
import Messages from './pages/Messages'
import EscrowDashboard from './pages/EscrowDashboard'
import EscrowDetail from './pages/EscrowDetail'
import PayoutDashboard from './pages/PayoutDashboard'
import AdminOverview from './pages/admin/AdminOverview'
import AdminVerifyQueue from './pages/admin/AdminVerifyQueue'
import AdminAuditLog from './pages/admin/AdminAuditLog'
import AdminEscrow from './pages/admin/AdminEscrow'
import AdminFinance from './pages/admin/AdminFinance'
import NotFound from './pages/NotFound'
import ErrorBoundary from './components/ErrorBoundary'
import useAuthStore from './stores/authStore'

function App() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <ErrorBoundary>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route
            path="dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="verify"
            element={
              <ProtectedRoute>
                <Verify />
              </ProtectedRoute>
            }
          />

          <Route path="listings" element={<Listings />} />
          <Route path="listings/:id" element={<ListingDetail />} />

          <Route
            path="post-listing"
            element={
              <ProtectedRoute>
                <CreateListing />
              </ProtectedRoute>
            }
          />

          <Route
            path="messages"
            element={
              <ProtectedRoute>
                <Messages />
              </ProtectedRoute>
            }
          />

          <Route
            path="dashboard/escrow"
            element={
              <ProtectedRoute>
                <EscrowDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/escrow/:id"
            element={
              <ProtectedRoute>
                <EscrowDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/payouts"
            element={
              <ProtectedRoute>
                <PayoutDashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin routes */}
          <Route
            path="admin"
            element={
              <ProtectedAdminRoute>
                <AdminLayout />
              </ProtectedAdminRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="verify" element={<AdminVerifyQueue />} />
            <Route path="audit-log" element={<AdminAuditLog />} />
            <Route path="escrow" element={<AdminEscrow />} />
            <Route path="finance" element={<AdminFinance />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
