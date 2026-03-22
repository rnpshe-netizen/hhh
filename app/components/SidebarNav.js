"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SidebarNav() {
  const pathname = usePathname();
  
  const navItems = [
    { 
      name: '대시보드', 
      href: '/', 
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg> 
    },
    { 
      name: '회원 관리', 
      href: '/members', 
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> 
    },
    { 
      name: '과정 관리', 
      href: '/courses', 
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> 
    }
  ];

  return (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {navItems.map(item => {
        const isActive = pathname === item.href;
        return (
          <Link key={item.href} href={item.href} style={{
            display: 'flex', alignItems: 'center', gap: '18px', padding: '16px 24px',
            color: isActive ? '#ffffff' : '#475569',
            backgroundColor: isActive ? '#4A90E2' : 'transparent',
            borderRadius: '16px', textDecoration: 'none', 
            fontWeight: isActive ? 700 : 600,
            fontSize: '18px',
            transition: 'all 0.2s ease',
            boxShadow: isActive ? '0 6px 16px rgba(74, 144, 226, 0.35)' : 'none'
          }}
          onMouseEnter={(e) => { if(!isActive) { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = '#1E293B'; } }}
          onMouseLeave={(e) => { if(!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#475569'; } }}
          >
            {item.icon}
            <span style={{ letterSpacing: '0.5px' }}>{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
