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
          {/* Logo Section (Naturally scaling white header to accommodate vertical logo) */}
          <div style={{ backgroundColor: '#ffffff', padding: '24px 20px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }}>
            <Link href="/" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', textDecoration: 'none', width: '100%' }}>
               <img src="/logo.png" alt="ICTI Logo" style={{ maxWidth: '100%', maxHeight: '110px', objectFit: 'contain' }} />
            </Link>
          </div>
          <div style={{ padding: '32px 18px' }}>
            <SidebarNav />
          </div>
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
