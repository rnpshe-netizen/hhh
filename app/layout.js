import './globals.css';
import Link from 'next/link';
import Topbar from './components/Topbar';
import SidebarNav from './components/SidebarNav';

export const metadata = {
  title: "ICTI-MIS | 국제코칭훈련원 통합업무시스템",
  description: "국제코칭훈련원 회원 및 수료 과정 한눈에 보기",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <div className="sidebar" style={{ backgroundColor: '#1E293B' }}>
          {/* Logo Section (Phase 1.8.1 Fix: White Contrast Backdrop) */}
          <div style={{ padding: '32px 20px 24px 20px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '24px' }}>
            <Link href="/" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', textDecoration: 'none' }}>
               <div style={{ 
                 backgroundColor: '#ffffff', 
                 padding: '12px 24px', 
                 borderRadius: '16px', 
                 display: 'flex', 
                 justifyContent: 'center', 
                 alignItems: 'center',
                 boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
               }}>
                 <img src="/logo.png" alt="ICTI Logo" style={{ maxWidth: '150px', maxHeight: '60px', objectFit: 'contain' }} />
               </div>
            </Link>
          </div>
          <SidebarNav />
        </div>
        
        <div className="main-wrapper">
          <Topbar />
          <main className="content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
