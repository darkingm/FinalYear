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
      signal: AbortSignal.timeout(25000), // 25s — enough for multi-provider cascade
    });

    if (!aiRes.ok) {
      throw new Error(`AI service returned ${aiRes.status}`);
    }

    const data = await aiRes.json();
    return NextResponse.json({
      reply: data.reply || data.message,
      provider: data.provider,
      model: data.model,
    });

  } catch (err: any) {
    console.error('[AI Chat Error]', err.message);

    // Return a friendly message — the AI service now returns 200 even on provider failures
    // This catch only triggers for network errors (service unreachable)
    return NextResponse.json({
      reply: 'AI trợ lý tạm thời không kết nối được. Vui lòng thử lại sau ít phút. 🔄',
      provider: 'error',
    });
  }
}
