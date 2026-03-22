import './globals.css';
import Link from 'next/link';
import Topbar from './components/Topbar';

export const metadata = {
  title: "국제코칭훈련원 통합 관리",
  description: "국제코칭훈련원 회원 및 수료 과정 한눈에 보기",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <div className="sidebar">
          <h2>코칭 통합 관리</h2>
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
