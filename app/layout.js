import './globals.css';
import Link from 'next/link';
import Topbar from './components/Topbar';
import SidebarNav from './components/SidebarNav';
import ClientProviders from './components/ClientProviders';

export const metadata = {
  title: "ICTI-MIS | 국제코칭훈련원 통합업무시스템",
  description: "국제코칭훈련원 회원 및 수료 과정 한눈에 보기",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <div className="sidebar" style={{ backgroundColor: '#F8FAFC', borderRight: '1px solid #E2E8F0' }}>
          {/* Logo Section - Light Theme (No bounding boxes needed) */}
          <div style={{ padding: '36px 20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Link href="/" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', textDecoration: 'none', width: '100%' }}>
               <img src="/logo.png" alt="ICTI Logo" style={{ maxWidth: '100%', maxHeight: '110px', objectFit: 'contain' }} />
            </Link>
          </div>
          <div style={{ padding: '16px 18px' }}>
            <SidebarNav />
          </div>
        </div>
        
        <ClientProviders>
          <div className="main-wrapper">
            <Topbar />
            <main className="content">
              {children}
            </main>
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
