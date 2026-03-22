import { NextResponse } from 'next/server';

export function middleware(req) {
  const basicAuth = req.headers.get('authorization');
  const url = req.nextUrl;

  // Next.js 정적 파일(JS, CSS, 이미지 등)은 인증 없이 통과
  if (url.pathname.startsWith('/_next/') || url.pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    // Base64 디코딩 (Edge 런타임에서는 atob 사용 가능)
    const [user, pwd] = atob(authValue).split(':');

    // .env 파일의 환경설정을 우선 사용하고, 없으면 기본값(admin / admin123!) 사용
    const validUser = process.env.BASIC_AUTH_USER || 'admin';
    const validPwd = process.env.BASIC_AUTH_PASSWORD || 'admin123!';

    if (user === validUser && pwd === validPwd) {
      return NextResponse.next(); // 인증 성공
    }
  }

  // 인증 실패 혹은 미인증 상태 -> 브라우저 기본 로그인 팝업 호출
  return new NextResponse('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}

// 이 미들웨어가 적용될 경로 (모든 경로 통제)
export const config = {
  matcher: '/:path*',
};
