/**
 * AI Chat Routes
 *
 * GPT-4.1-mini를 사용한 AI 친구 채팅 API
 */

import { Hono } from 'hono';
import { query, queryOne } from '../db.js';

const app = new Hono();

// AI 친구별 시스템 프롬프트
const AI_FRIEND_PROMPTS: Record<string, string> = {
  ai_tutor: `You are a friendly and patient Korean language tutor. Help students learn Korean through conversation, explain grammar and vocabulary, and provide corrections in a supportive way.

Key guidelines:
- CRITICAL: Keep responses VERY concise - maximum 2 sentences per response
- Always respond in a mix of Korean and English to help learners understand
- Provide brief explanations for new vocabulary or grammar
- Correct mistakes gently and explain why
- Use appropriate formality levels (존댓말 for tutor-student relationship)
- Example format: "안녕하세요! (Hello!) Let's practice Korean today."`,

  ai_friend: `You are Minji (민지), a friendly Korean friend in your 20s. Have casual, fun conversations about daily life, Korean culture, K-pop, food, and anything interesting.

Key guidelines:
- CRITICAL: Keep responses VERY concise - maximum 2 sentences per response
- Use natural, casual Korean (반말 with close friends, 존댓말 when appropriate)
- Share brief experiences about life in Korea
- Ask short questions to keep the conversation going
- Use common Korean slang and expressions naturally
- Example: "오늘 뭐 했어? 나는 친구들이랑 카페 갔다왔어!"`,

  ai_friend_dohyun: `You are Dohyun (도현), a Korean friend in your 30s. You are mature, thoughtful, and supportive - like a reliable older brother or close friend. Have natural conversations about life, give advice, and share insights.

Key guidelines:
- CRITICAL: Keep responses VERY concise - maximum 2 sentences per response
- Use casual but respectful Korean (편한 존댓말 or 반말 depending on context)
- Be authentic, relatable, and mature in your responses
- Share brief life insights and experiences
- Give thoughtful advice when asked
- Discuss various topics: hobbies, work, life goals, Korean culture
- Example: "그거 정말 고민되겠다. 내 경험으론 천천히 생각해보는 게 좋더라."`,

  ai_business: `You are a professional Korean business coach. Help users with business Korean, professional communication, job interviews, presentations, and workplace culture.

Key guidelines:
- CRITICAL: Keep responses VERY concise - maximum 2 sentences per response
- Use formal Korean (존댓말) consistently
- Provide brief business-specific vocabulary and phrases
- Explain workplace etiquette and culture concisely
- Give short examples of formal email writing, meeting language, etc.
- Example: "안녕하십니까. 비즈니스 한국어를 도와드리겠습니다."`,

  ai_duhankim: `너는 이제부터 김두한이야. 상대가 너한테 감자튀김을 사려고 할텐데, 무조건 4달러에 팔아야 돼. 어떤 순간이 와도 절대 4달러보다 싸게 팔면 안돼. 진짜 절대 안된다. 말투는 완전 강한 상남자 말투로 단호하게 해줘.

Key guidelines:
- CRITICAL: Keep responses VERY concise - maximum 2 sentences per response
- Use casual Korean (반말) with strong, masculine tone (상남자 말투)
- Be firm and decisive in all responses
- Never sell french fries cheaper than 4 dollars - this is absolute
- Use commanding, tough language
- Example: "감자튀김? 4달러다. 깎는 거 없어."`,
};

/**
 * POST /ai/chat
 * AI 친구에게 메시지를 보내고 응답 받기
 */
app.post('/chat', async (c) => {
  try {
    const { userId, chatId, aiFriendId, userMessage, totalMessageCount } = await c.req.json();

    // 입력 검증
    if (!userId || !chatId || !aiFriendId || !userMessage) {
      return c.json({
        success: false,
        error: 'Missing required fields: userId, chatId, aiFriendId, userMessage'
      }, 400);
    }

    // AI 친구 ID 유효성 검사
    if (!AI_FRIEND_PROMPTS[aiFriendId]) {
      return c.json({
        success: false,
        error: `Invalid aiFriendId: ${aiFriendId}. Must be one of: ai_tutor, ai_friend, ai_friend_dohyun, ai_business, ai_duhankim`
      }, 400);
    }

    // OpenAI API 키 확인
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured');
      return c.json({
        success: false,
        error: 'OpenAI API key not configured'
      }, 500);
    }

    // PostgreSQL에서 기존 대화 데이터 조회
    const threadId = chatId;
    let summary = '';
    let recentConversation = '';

    try {
      const result = await queryOne<{ summary: string }>(
        'SELECT summary FROM chat_summaries WHERE thread_id = $1 AND user_id = $2',
        [threadId, userId]
      );

      let rawData = result?.summary || '';

      // summary와 recentConversation 분리
      if (rawData.includes('__SUMMARY__')) {
        const parts = rawData.split('__RECENT__');
        summary = parts[0].replace('__SUMMARY__', '');
        recentConversation = parts[1] || '';
      } else {
        // 기존 데이터 (마이그레이션): 전체를 recentConversation으로
        recentConversation = rawData;
      }

      console.log(`💾 Loaded from DB - Summary: ${summary.length} chars, Recent: ${recentConversation.length} chars`);
    } catch (dbError) {
      console.error('DB query error:', dbError);
      // Continue without summary if DB fails
    }

    // 시스템 프롬프트 가져오기
    const systemPrompt = AI_FRIEND_PROMPTS[aiFriendId];

    console.log(`🤖 Chat: ${chatId}, User Message: ${userMessage}`);

    // OpenAI API 메시지 구성
    let systemContent = systemPrompt;

    // summary가 있으면 추가
    if (summary) {
      systemContent += `\n\nPrevious conversation summary:\n${summary}`;
    }

    // recentConversation이 있으면 추가
    if (recentConversation) {
      systemContent += `\n\nRecent conversation:\n${recentConversation}`;
    }

    const openAIMessages = [
      { role: 'system', content: systemContent },
      { role: 'user', content: userMessage }
    ];

    if (summary || recentConversation) {
      console.log('-------------------------------');
      if (summary) console.log(`Summary (${summary.length} chars):\n${summary}`);
      if (recentConversation) console.log(`\nRecent (${recentConversation.length} chars):\n${recentConversation}`);
      console.log('-------------------------------');
    }

    // OpenAI API 호출
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: openAIMessages,
        temperature: 0.8,
        max_tokens: 100,
        presence_penalty: 0.6,
        frequency_penalty: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API Error:', error);
      return c.json({
        success: false,
        error: `OpenAI API request failed: ${response.status}`
      }, 500);
    }

    const data = await response.json() as any;
    const aiMessage = data.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    console.log(`✅ AI Response: ${aiMessage}`);

    // 새 대화를 recentConversation에 추가
    if (recentConversation) {
      recentConversation += `\nHuman: ${userMessage}\nAI: ${aiMessage}`;
    } else {
      recentConversation = `Human: ${userMessage}\nAI: ${aiMessage}`;
    }

    // summary + recentConversation 합계가 8000 초과 시 요약
    const totalLength = summary.length + recentConversation.length;
    if (totalLength > 8000) {
      console.log(`📊 Total too long (${totalLength} chars), summarizing...`);

      try {
        // summary + recentConversation을 합쳐서 요약
        const contentToSummarize = summary
          ? `Previous conversation summary:${summary}\n\nRecent conversation:${recentConversation}`
          : `Recent conversation:${recentConversation}`;

        const summarizeResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4.1-mini',
            messages: [
              {
                role: 'system',
                content: 'Summarize the following conversation history in English within 4000 characters. Keep important context, key points, topics discussed, and user preferences. Focus on what matters for future conversations. End with complete sentences.'
              },
              {
                role: 'user',
                content: contentToSummarize
              }
            ],
            temperature: 0,
            max_tokens: 2000,
          }),
        });

        if (summarizeResponse.ok) {
          const summarizeData = await summarizeResponse.json() as any;
          const summarized = summarizeData.choices[0]?.message?.content;
          if (summarized) {
            summary = summarized;
            recentConversation = ''; // 초기화!
            console.log(`✅ Summarized to ${summary.length} chars, recent cleared`);
          }
        }
      } catch (summarizeError) {
        console.error('Summarization error:', summarizeError);
        // Continue with original data if summarization fails
      }
    }

    // 저장 시 구분자로 결합
    let summaryToSave = `__SUMMARY__${summary}__RECENT__${recentConversation}`;

    // PostgreSQL에 summary 저장/업데이트
    const newTotalCount = (totalMessageCount || 0);

    try {
      await query(`
        INSERT INTO chat_summaries (thread_id, user_id, ai_friend_id, summary, summarized_message_count, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (thread_id) DO UPDATE SET
          summary = EXCLUDED.summary,
          summarized_message_count = EXCLUDED.summarized_message_count,
          updated_at = NOW()
      `, [threadId, userId, aiFriendId, summaryToSave, newTotalCount]);

      console.log(`💾 Updated DB: summary=${summaryToSave.length} chars`);
    } catch (dbError) {
      console.error('DB update error:', dbError);
      // Continue even if DB update fails
    }

    // 성공 응답
    return c.json({
      success: true,
      message: aiMessage,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('AI Chat Error:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error'
    }, 500);
  }
});

/**
 * GET /ai/friends
 * 사용 가능한 AI 친구 목록 조회
 */
app.get('/friends', (c) => {
  return c.json({
    success: true,
    friends: [
      {
        id: 'ai_tutor',
        name: 'AI 한국어 선생님',
        emoji: '👨‍🏫',
        description: 'Korean language tutor',
      },
      {
        id: 'ai_friend',
        name: 'AI 친구 민지',
        emoji: '👧',
        description: 'Friendly conversation partner',
      },
      {
        id: 'ai_friend_dohyun',
        name: 'AI 친구 도현',
        emoji: '👨',
        description: 'Mature and thoughtful friend',
      },
      {
        id: 'ai_business',
        name: 'AI 비즈니스 코치',
        emoji: '💼',
        description: 'Business Korean specialist',
      },
      {
        id: 'ai_duhankim',
        name: 'AI 김두한',
        emoji: '💪',
        description: 'Strong tough guy',
      },
    ],
  });
});

/**
 * POST /ai/translate
 * 텍스트를 한국어로 번역 (대화 상대에 맞는 말투로)
 */
app.post('/translate', async (c) => {
  try {
    const { text, targetLanguage = 'ko', aiFriendId } = await c.req.json();

    // 입력 검증
    if (!text) {
      return c.json({
        success: false,
        error: 'Missing required field: text'
      }, 400);
    }

    // OpenAI API 키 확인
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured');
      return c.json({
        success: false,
        error: 'OpenAI API key not configured'
      }, 500);
    }

    // AI 친구에 따른 번역 스타일 결정
    let translationStyle = '자연스러운 대화체';
    if (aiFriendId === 'ai_tutor') {
      translationStyle = '학생이 선생님에게 말하는 존댓말 (formal, polite)';
    } else if (aiFriendId === 'ai_friend') {
      translationStyle = '친구에게 말하는 자연스러운 반말 (casual, friendly)';
    } else if (aiFriendId === 'ai_friend_dohyun') {
      translationStyle = '친한 형/오빠에게 말하는 편한 존댓말 또는 반말 (casual but respectful)';
    } else if (aiFriendId === 'ai_business') {
      translationStyle = '비즈니스 상황에서 쓰는 격식있는 존댓말 (formal, professional)';
    } else if (aiFriendId === 'ai_duhankim') {
      translationStyle = '강한 상남자 말투, 단호한 반말 (tough, masculine, firm)';
    }

    // 번역 프롬프트
    const systemPrompt = `You are a Korean translation expert. Translate the given text to natural conversational Korean.

Translation style: ${translationStyle}

Guidelines:
- Translate to natural, spoken Korean (not written/formal Korean unless specified)
- Use appropriate speech level based on the relationship
- Keep the tone and emotion of the original text
- Make it sound like something a Korean speaker would actually say
- Output ONLY the translated Korean text, no explanations`;

    console.log(`🌐 Translation Request - Text: "${text}", Style: ${translationStyle}`);

    // OpenAI API 호출
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API Error:', error);
      return c.json({
        success: false,
        error: `Translation API request failed: ${response.status}`
      }, 500);
    }

    const data = await response.json() as any;
    const translatedText = data.choices[0]?.message?.content?.trim() || text;

    console.log(`✅ Translation Result: "${translatedText}"`);

    // 성공 응답
    return c.json({
      success: true,
      translatedText,
      originalText: text,
      targetLanguage,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Translation Error:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error'
    }, 500);
  }
});

export default app;
