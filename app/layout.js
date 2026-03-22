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
          {/* Logo Section (Seamless Top Header matching Topbar) */}
          <div style={{ backgroundColor: '#ffffff', height: '70px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
            <Link href="/" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', textDecoration: 'none', width: '100%', height: '100%' }}>
               <img src="/logo.png" alt="ICTI Logo" style={{ maxWidth: '180px', maxHeight: '50px', objectFit: 'contain' }} />
            </Link>
          </div>
          <div style={{ padding: '32px 0' }}>
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
