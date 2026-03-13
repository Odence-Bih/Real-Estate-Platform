import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/verify', label: 'Verification Queue' },
  { to: '/admin/escrow', label: 'Escrow Management' },
  { to: '/admin/finance', label: 'Financial Reports' },
  { to: '/admin/audit-log', label: 'Audit Log' },
]

export default function AdminLayout() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Admin Dashboard
      </h1>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <nav className="md:w-56 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `block px-4 py-3 text-sm font-medium border-b border-gray-100 last:border-b-0 transition-colors ${
                    isActive
                      ? 'bg-green-50 text-green-700 border-l-4 border-l-green-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
