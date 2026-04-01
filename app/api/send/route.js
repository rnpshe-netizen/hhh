// 메시지 발송 API — 솔라피 REST API(카카오+SMS) + Resend SDK(이메일)
import { NextResponse } from 'next/server';
import crypto from 'crypto';

// 솔라피 HMAC 인증 헤더 생성
function getSolapiAuthHeader(apiKey, apiSecret) {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(32).toString('hex');
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export async function POST(request) {
  try {
    const { channel, recipients, subject, body } = await request.json();

    if (!channel || !recipients || !body) {
      return NextResponse.json({ error: '필수 파라미터 누락 (channel, recipients, body)' }, { status: 400 });
    }

    const results = [];

    // 카카오 알림톡 또는 SMS — 솔라피 REST API 직접 호출
    if (channel === 'kakao' || channel === 'sms') {
      const apiKey = process.env.SOLAPI_API_KEY;
      const apiSecret = process.env.SOLAPI_API_SECRET;
      const senderPhone = process.env.SOLAPI_SENDER_PHONE;

      if (!apiKey || !apiSecret || !senderPhone) {
        return NextResponse.json({
          error: '솔라피 환경변수 미설정. SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER_PHONE 필요.'
        }, { status: 500 });
      }

      const authorization = getSolapiAuthHeader(apiKey, apiSecret);

      // 메시지 구성
      const messages = recipients.map(r => ({
        to: r.phone.replace(/-/g, ''),
        from: senderPhone.replace(/-/g, ''),
        text: body,
        ...(channel === 'kakao' ? { type: 'ATA' } : {}),
      }));

      // 500건씩 배치 발송
      for (let i = 0; i < messages.length; i += 500) {
        const batch = messages.slice(i, i + 500);
        try {
          const res = await fetch('https://api.solapi.com/messages/v4/send-many', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authorization,
            },
            body: JSON.stringify({ messages: batch }),
          });
          const rawText = await res.text();
          let data;
          try { data = JSON.parse(rawText); } catch { data = { rawText }; }

          if (data.groupInfo) {
            results.push({
              batch: Math.floor(i / 500) + 1,
              success: data.groupInfo.successCount || 0,
              fail: data.groupInfo.failCount || 0,
            });
          } else {
            // 에러 응답
            results.push({
              batch: Math.floor(i / 500) + 1,
              success: 0,
              fail: batch.length,
              error: data.errorCode || data.errorMessage || data.rawText || JSON.stringify(data),
              httpStatus: res.status,
            });
          }
        } catch (err) {
          results.push({
            batch: Math.floor(i / 500) + 1,
            success: 0,
            fail: batch.length,
            error: err.message,
          });
        }
      }
    }

    // 이메일 — Resend SDK
    if (channel === 'email') {
      const resendKey = process.env.RESEND_API_KEY;
      const senderEmail = process.env.RESEND_SENDER_EMAIL || 'onboarding@resend.dev';

      if (!resendKey) {
        return NextResponse.json({ error: 'RESEND_API_KEY 환경변수 미설정.' }, { status: 500 });
      }

      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);

      // 50건씩 병렬 발송
      for (let i = 0; i < recipients.length; i += 50) {
        const batch = recipients.slice(i, i + 50);
        const promises = batch.map(r =>
          resend.emails.send({
            from: senderEmail,
            to: r.email,
            subject: subject || '[국제코칭훈련원] 안내',
            text: body,
          }).then(() => ({ success: true }))
            .catch(err => ({ success: false, error: err.message }))
        );

        const batchResults = await Promise.all(promises);
        const successCount = batchResults.filter(r => r.success).length;
        results.push({
          batch: Math.floor(i / 50) + 1,
          success: successCount,
          fail: batch.length - successCount,
        });
      }
    }

    const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
    const totalFail = results.reduce((sum, r) => sum + r.fail, 0);

    return NextResponse.json({
      success: true,
      channel,
      totalSuccess,
      totalFail,
      batches: results,
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
