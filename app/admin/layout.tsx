export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-y-auto z-50 bg-[#F5F5F5]">
      {children}
    </div>
  )
}
