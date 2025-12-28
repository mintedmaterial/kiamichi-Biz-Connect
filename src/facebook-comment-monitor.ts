// Facebook Comment Monitoring & Auto-Response System
// Monitors comments on our Facebook posts and generates helpful responses

import type { Env } from './types';

export interface CommentData {
  id: string;
  post_id: string;
  from: {
    id: string;
    name: string;
  };
  message: string;
  created_time: string;
  can_reply: boolean;
}

export interface CommentAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative' | 'question';
  shouldRespond: boolean;
  suggestedResponse?: string;
  reasoning: string;
}

/**
 * Fetch recent comments from our Facebook posts
 */
export async function fetchRecentComments(
  env: Env,
  postIds: string[],
  pageAccessToken: string
): Promise<CommentData[]> {
  const allComments: CommentData[] = [];

  for (const postId of postIds) {
    try {
      const url = `https://graph.facebook.com/v19.0/${postId}/comments?fields=id,from,message,created_time,can_reply&access_token=${pageAccessToken}`;

      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch comments for post ${postId}:`, await response.text());
        continue;
      }

      const data = await response.json();
      const comments = data.data || [];

      for (const comment of comments) {
        allComments.push({
          id: comment.id,
          post_id: postId,
          from: comment.from,
          message: comment.message,
          created_time: comment.created_time,
          can_reply: comment.can_reply !== false
        });
      }

    } catch (error) {
      console.error(`Error fetching comments for post ${postId}:`, error);
    }
  }

  return allComments;
}

/**
 * Analyze comment to determine if we should respond
 */
export async function analyzeComment(
  comment: CommentData,
  postContext: string,
  env: Env
): Promise<CommentAnalysis> {
  const prompt = `Analyze this Facebook comment on our local business directory post:

Post context: "${postContext.substring(0, 200)}"
Comment from ${comment.from.name}: "${comment.message}"

Determine:
1. Sentiment (positive/neutral/negative/question)
2. Should we respond? (respond to: questions, negative feedback, engagement opportunities)
3. If yes, suggest a friendly, helpful response (60-80 words, conversational tone)

Respond in JSON: {"sentiment": "question", "shouldRespond": true, "suggestedResponse": "...", "reasoning": "..."}`;

  try {
    const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You are a helpful community manager for a local business directory in Southeast Oklahoma. You respond warmly, helpfully, and genuinely to comments.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    const text = (response as any).response || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        sentiment: parsed.sentiment || 'neutral',
        shouldRespond: parsed.shouldRespond || false,
        suggestedResponse: parsed.suggestedResponse || undefined,
        reasoning: parsed.reasoning || 'AI analysis'
      };
    }
  } catch (error) {
    console.error('Comment analysis failed:', error);
  }

  // Fallback: respond to questions (contains ?)
  const isQuestion = comment.message.includes('?');
  return {
    sentiment: isQuestion ? 'question' : 'neutral',
    shouldRespond: isQuestion,
    suggestedResponse: isQuestion
      ? `Thanks for your question! You can find more information at kiamichibizconnect.com. Feel free to reach out if you need anything else!`
      : undefined,
    reasoning: 'Fallback - detected question mark'
  };
}

/**
 * Post a reply to a comment
 */
export async function replyToComment(
  commentId: string,
  message: string,
  pageAccessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `https://graph.facebook.com/v19.0/${commentId}/comments`;

    const params = new URLSearchParams({
      message,
      access_token: pageAccessToken
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || 'Unknown error'
      };
    }

    const result = await response.json();
    console.log(`Successfully replied to comment ${commentId}:`, result.id);

    return { success: true };

  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
}

/**
 * Process comments and auto-respond where appropriate
 * Returns number of responses posted
 */
export async function processComments(
  env: Env,
  postIds: string[],
  postContextMap: Map<string, string>,
  pageAccessToken: string
): Promise<{ analyzed: number; responded: number; failed: number }> {
  let analyzed = 0;
  let responded = 0;
  let failed = 0;

  // Fetch all recent comments
  const comments = await fetchRecentComments(env, postIds, pageAccessToken);
  console.log(`Fetched ${comments.length} comments from ${postIds.length} posts`);

  // Check which comments we've already responded to (stored in KV)
  const respondedCommentsKey = 'facebook:responded_comments';
  const respondedCommentsJson = await env.CACHE.get(respondedCommentsKey);
  const respondedComments = new Set<string>(
    respondedCommentsJson ? JSON.parse(respondedCommentsJson) : []
  );

  for (const comment of comments) {
    // Skip if we've already responded
    if (respondedComments.has(comment.id)) {
      console.log(`Already responded to comment ${comment.id}, skipping`);
      continue;
    }

    // Skip if we can't reply
    if (!comment.can_reply) {
      console.log(`Cannot reply to comment ${comment.id}, skipping`);
      continue;
    }

    analyzed++;

    const postContext = postContextMap.get(comment.post_id) || 'Local business post';

    // Analyze comment
    const analysis = await analyzeComment(comment, postContext, env);
    console.log(`Comment ${comment.id} analysis:`, {
      sentiment: analysis.sentiment,
      shouldRespond: analysis.shouldRespond,
      reasoning: analysis.reasoning
    });

    // Respond if appropriate
    if (analysis.shouldRespond && analysis.suggestedResponse) {
      const result = await replyToComment(
        comment.id,
        analysis.suggestedResponse,
        pageAccessToken
      );

      if (result.success) {
        responded++;
        // Track that we responded
        respondedComments.add(comment.id);
        console.log(`Posted response to comment ${comment.id}`);
      } else {
        failed++;
        console.error(`Failed to respond to comment ${comment.id}:`, result.error);
      }

      // Rate limit between responses
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Save updated responded comments list (expire after 30 days)
  await env.CACHE.put(
    respondedCommentsKey,
    JSON.stringify(Array.from(respondedComments)),
    { expirationTtl: 30 * 24 * 60 * 60 }
  );

  console.log(`Comment processing complete: ${analyzed} analyzed, ${responded} responded, ${failed} failed`);
  return { analyzed, responded, failed };
}
