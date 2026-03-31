import { NextResponse } from 'next/server';

export function proxy(req) {
  const basicAuth = req.headers.get('authorization');
  const url = req.nextUrl;

  // Next.js 내부 요청은 인증 없이 통과
  // 1) 정적 파일 (JS, CSS, 이미지 등)
  if (url.pathname.startsWith('/_next/') || url.pathname === '/favicon.ico') {
    return NextResponse.next();
  }
  // 2) RSC 내부 네비게이션 fetch — 다양한 헤더로 감지
  const isRSC = req.headers.get('rsc') === '1'
    || req.headers.get('next-router-state-tree')
    || req.headers.get('next-url')
    || req.headers.get('purpose') === 'prefetch'
    || req.headers.get('x-nextjs-data');
  if (isRSC) {
    return NextResponse.next();
  }

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    const validUser = process.env.BASIC_AUTH_USER || 'admin';
    const validPwd = process.env.BASIC_AUTH_PASSWORD || 'admin123!';

    if (user === validUser && pwd === validPwd) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}

// 정적 파일·이미지 최적화 경로는 아예 미들웨어 실행 제외
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|logo\\.png|matching_report\\.json).*)',
  ],
};
