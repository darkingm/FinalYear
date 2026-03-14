import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8000';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    const body = await req.json();
    const { message } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Build messages array for AI service
    const messages = [
      { role: 'user', content: message.trim() }
    ];

    // Add user context if logged in
    const userContext = session?.user
      ? `\n[Người dùng: ${session.user.name || session.user.email}]`
      : '';

    const aiRes = await fetch(`${AI_SERVICE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        user_id: (session?.user as any)?.id,
        context: userContext,
      }),
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!aiRes.ok) {
      // Fallback to Groq directly if AI service unavailable
      throw new Error(`AI service returned ${aiRes.status}`);
    }

    const data = await aiRes.json();
    return NextResponse.json({ reply: data.reply || data.message });

  } catch (err: any) {
    console.error('[AI Chat Error]', err.message);

    // Fallback: try Groq API directly from frontend
    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (GROQ_KEY) {
      try {
        const body = await req.json().catch(() => ({}));
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${GROQ_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              {
                role: 'system',
                content: 'Bạn là AI trợ lý của Web3Market - sàn thương mại điện tử crypto. Trả lời ngắn gọn, thân thiện bằng tiếng Việt.',
              },
              { role: 'user', content: body.message || '' },
            ],
            max_tokens: 512,
            temperature: 0.7,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const reply = groqData.choices?.[0]?.message?.content;
          if (reply) return NextResponse.json({ reply });
        }
      } catch (_e) { /* ignore fallback error */ }
    }

    // Final fallback: friendly error
    return NextResponse.json({
      reply: 'Xin lỗi, AI trợ lý đang bảo trì 🙏 Vui lòng thử lại sau hoặc liên hệ hỗ trợ.',
    });
  }
}
