import { Env, PostAnalysisResult } from './types';

/**
 * Analyze post quality using Workers AI
 */
export async function analyzePostQuality(
  post: any,
  businessName: string,
  env: Env
): Promise<PostAnalysisResult> {
  const message = post.message || '';
  const likes = post.reactions?.summary?.total_count || 0;
  const comments = post.comments?.summary?.total_count || 0;
  const shares = post.shares?.count || 0;

  const prompt = `Analyze this Facebook post from "${businessName}":

"${message.substring(0, 500)}"

Engagement: ${likes} likes, ${comments} comments, ${shares} shares

Score this post 0-100 based on:
1. Business relevance (not personal/spam)
2. Professional quality
3. Engagement metrics
4. Content value

Provide 2-3 relevant tags (e.g., "Service", "Promotion", "Community").

Respond in JSON: {"score": 85, "tags": ["Service", "Quality"], "reasoning": "..."}`;

  try {
    const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const text = (response as any).response || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        quality_score: Math.min(100, Math.max(0, parsed.score || 0)),
        relevance_tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : [],
        reasoning: parsed.reasoning || '',
      };
    }
  } catch (error) {
    console.error('AI analysis failed, using fallback:', error);
  }

  // Fallback rule-based scoring
  const engagementScore = Math.min(50, likes + comments * 2 + shares * 3);
  const lengthScore = message.length > 50 && message.length < 500 ? 30 : 15;
  const hasHashtags = message.includes('#') ? 10 : 0;

  return {
    quality_score: engagementScore + lengthScore + hasHashtags,
    relevance_tags: ['Post'],
    reasoning: 'Fallback scoring',
  };
}

/**
 * Select top posts from a list
 */
export async function selectTopPosts(
  posts: any[],
  businessName: string,
  env: Env
): Promise<Array<any & { analysis: PostAnalysisResult }>> {
  const analyzed = await Promise.all(
    posts.map(async (post) => ({
      ...post,
      analysis: await analyzePostQuality(post, businessName, env),
    }))
  );

  return analyzed
    .sort((a, b) => b.analysis.quality_score - a.analysis.quality_score)
    .slice(0, 3);
}

/**
 * Calculate verification score based on page info and posts
 */
export function calculateVerificationScore(
  pageInfo: any,
  posts: any[]
): number {
  let score = 0;

  // Page completeness (40 points)
  if (pageInfo.about) score += 10;
  if (pageInfo.phone) score += 10;
  if (pageInfo.website) score += 10;
  if (pageInfo.location) score += 10;

  // Reviews (30 points)
  if (pageInfo.rating_count > 0) {
    score += Math.min(15, pageInfo.rating_count * 3);
  }
  if (pageInfo.overall_star_rating >= 4.0) {
    score += 15;
  }

  // Activity (30 points)
  const postCount = posts.length;
  score += Math.min(15, postCount * 3);

  const hasRecentPost = posts.some((p) => {
    const postDate = new Date(p.created_time);
    const daysSince = (Date.now() - postDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince < 30;
  });
  if (hasRecentPost) score += 15;

  return Math.min(100, score);
}
