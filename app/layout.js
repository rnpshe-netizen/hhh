import './globals.css';
import Link from 'next/link';
import Topbar from './components/Topbar';

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
          <div style={{ padding: '24px 20px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px' }}>
            <Link href="/" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50px', gap: '10px', textDecoration: 'none' }}>
               <img src="/logo.png" alt="" style={{ maxWidth: '40px', maxHeight: '40px', objectFit: 'contain' }} />
               <span style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold', letterSpacing: '1px' }}>ICTI-MIS</span>
            </Link>
          </div>
          <nav>
            <Link href="/">📊 대시보드</Link>
            <Link href="/members">👥 회원 관리</Link>
            <Link href="/courses">📚 과정 관리</Link>
          </nav>
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
