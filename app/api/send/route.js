// 메시지 발송 API — 솔라피(카카오+SMS) + Resend(이메일)
import { NextResponse } from 'next/server';

// 솔라피 SDK
let SolapiMessageService;
try {
  SolapiMessageService = require('solapi').SolapiMessageService;
} catch (e) {}

// Resend SDK
let Resend;
try {
  Resend = require('resend').Resend;
} catch (e) {}

export async function POST(request) {
  try {
    const { channel, recipients, subject, body } = await request.json();

    if (!channel || !recipients || !body) {
      return NextResponse.json({ error: '필수 파라미터 누락 (channel, recipients, body)' }, { status: 400 });
    }

    const results = [];

    // 카카오 알림톡 또는 SMS — 솔라피 사용
    if (channel === 'kakao' || channel === 'sms') {
      const apiKey = process.env.SOLAPI_API_KEY;
      const apiSecret = process.env.SOLAPI_API_SECRET;
      const senderPhone = process.env.SOLAPI_SENDER_PHONE; // 발신번호 (솔라피에서 등록한 번호)

      if (!apiKey || !apiSecret) {
        return NextResponse.json({ error: '솔라피 API 키가 설정되지 않았습니다. Vercel 환경변수에 SOLAPI_API_KEY, SOLAPI_API_SECRET을 추가하세요.' }, { status: 500 });
      }

      const messageService = new SolapiMessageService(apiKey, apiSecret);

      // 한 번에 최대 10,000건 발송 가능
      const messages = recipients.map(r => {
        if (channel === 'kakao') {
          // 카카오 알림톡 (템플릿 ID 필요 — 솔라피 대시보드에서 등록)
          return {
            to: r.phone.replace(/-/g, ''),
            from: senderPhone,
            text: body,
            type: 'ATA', // 알림톡
            // kakaoOptions: { pfId: process.env.SOLAPI_KAKAO_PFID, templateId: 'TEMPLATE_ID' },
            // 알림톡 템플릿 미등록 시 SMS로 대체 발송
          };
        } else {
          // SMS/LMS
          const byteLength = new TextEncoder().encode(body).length;
          return {
            to: r.phone.replace(/-/g, ''),
            from: senderPhone,
            text: body,
            type: byteLength > 90 ? 'LMS' : 'SMS',
          };
        }
      });

      // 500건씩 나눠서 발송
      for (let i = 0; i < messages.length; i += 500) {
        const batch = messages.slice(i, i + 500);
        try {
          const response = await messageService.send(batch);
          results.push({
            batch: Math.floor(i / 500) + 1,
            success: response.groupInfo?.successCount || batch.length,
            fail: response.groupInfo?.failCount || 0,
          });
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

    // 이메일 — Resend 사용
    if (channel === 'email') {
      const resendKey = process.env.RESEND_API_KEY;
      const senderEmail = process.env.RESEND_SENDER_EMAIL || 'onboarding@resend.dev';

      if (!resendKey) {
        return NextResponse.json({ error: 'Resend API 키가 설정되지 않았습니다. Vercel 환경변수에 RESEND_API_KEY를 추가하세요.' }, { status: 500 });
      }

      const resend = new Resend(resendKey);

      // Resend는 건당 발송 (배치 API 없음), 500건씩 처리
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

    // 전체 결과 집계
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
