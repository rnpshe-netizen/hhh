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
          {/* Logo Section */}
          <div style={{ padding: '36px 20px 28px 20px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '24px' }}>
            <Link href="/" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '16px', textDecoration: 'none' }}>
               <img src="/logo.png" alt="Logo" style={{ maxWidth: '140px', maxHeight: '75px', objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }} />
               <span style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold', letterSpacing: '1px' }}>ICTI-MIS</span>
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
