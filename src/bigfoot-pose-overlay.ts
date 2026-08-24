import type { Env } from './types';

/**
 * Deterministic Bigfoot pose/overlay contract for KBC social creative.
 *
 * The character image is always a reusable transparent asset from R2. Exact
 * business names, facts, and copy are rendered locally in SVG so AI cannot
 * corrupt them with hallucinated lettering.
 */
export type BigfootPose =
  | 'wave'
  | 'point'
  | 'thumbs-up'
  | 'thinking'
  | 'celebrate'
  | 'walk';

export type BigfootBubble = 'speech' | 'thought' | 'none';
export type BigfootPostType =
  | 'business_spotlight'
  | 'blog_share'
  | 'category_highlight'
  | 'engagement_prompt';

export interface BigfootOverlayRequest {
  businessId: number | string;
  businessName: string;
  businessType?: string;
  city?: string;
  postType: BigfootPostType;
  copy: string;
  seed?: string | number;
  pose?: BigfootPose;
  bubble?: BigfootBubble;
  assetVersion?: string;
}

export interface BigfootOverlayPlan {
  assetKey: string;
  assetUrl: string;
  pose: BigfootPose;
  bubble: BigfootBubble;
  copy: string;
  metadata: {
    mascot: 'bigfoot-jr';
    businessId: string;
    businessName: string;
    postType: BigfootPostType;
    generatedAt: string;
    assetVersion: string;
  };
}

const DEFAULT_VERSION = 'v1';
const POSES_BY_POST: Record<BigfootPostType, BigfootPose[]> = {
  business_spotlight: ['wave', 'point', 'thumbs-up', 'celebrate'],
  blog_share: ['thinking', 'point'],
  category_highlight: ['celebrate', 'thumbs-up', 'wave'],
  engagement_prompt: ['thinking', 'wave'],
};

const POSE_ASSET_KEYS: Record<BigfootPose, string> = {
  wave: 'mascots/bigfoot/v1/poses/wave.png',
  point: 'mascots/bigfoot/v1/poses/point.png',
  'thumbs-up': 'mascots/bigfoot/v1/poses/thumbs-up.png',
  thinking: 'mascots/bigfoot/v1/poses/thinking.png',
  celebrate: 'mascots/bigfoot/v1/poses/celebrate.png',
  walk: 'mascots/bigfoot/v1/poses/walk.png',
};

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function chooseBigfootPose(
  postType: BigfootPostType,
  businessId: number | string,
  seed: string | number = '',
): BigfootPose {
  const poses = POSES_BY_POST[postType];
  return poses[stableHash(`${postType}:${businessId}:${seed}`) % poses.length];
}

export function chooseBigfootBubble(postType: BigfootPostType): BigfootBubble {
  if (postType === 'engagement_prompt') return 'thought';
  if (postType === 'blog_share') return 'none';
  return 'speech';
}

export function createBigfootOverlayPlan(
  env: Pick<Env, 'SITE_URL'>,
  request: BigfootOverlayRequest,
): BigfootOverlayPlan {
  const assetVersion = request.assetVersion ?? DEFAULT_VERSION;
  const pose = request.pose ?? chooseBigfootPose(request.postType, request.businessId, request.seed);
  const bubble = request.bubble ?? chooseBigfootBubble(request.postType);
  const assetKey = POSE_ASSET_KEYS[pose].replace('/v1/', `/${assetVersion}/`);

  return {
    assetKey,
    assetUrl: `${env.SITE_URL}/assets/${assetKey}`,
    pose,
    bubble,
    copy: request.copy,
    metadata: {
      mascot: 'bigfoot-jr',
      businessId: String(request.businessId),
      businessName: request.businessName,
      postType: request.postType,
      generatedAt: new Date().toISOString(),
      assetVersion,
    },
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export interface BigfootSvgOverlayOptions {
  width: number;
  height: number;
  backgroundUrl?: string;
  mascotScale?: number;
  mascotX?: number;
  mascotY?: number;
}

/** Render a deterministic SVG composition. Text never goes through image AI. */
export function renderBigfootSvgOverlay(
  plan: BigfootOverlayPlan,
  options: BigfootSvgOverlayOptions,
): string {
  const width = Math.max(1, Math.round(options.width));
  const height = Math.max(1, Math.round(options.height));
  const scale = options.mascotScale ?? 0.42;
  const mascotWidth = Math.round(width * scale);
  const mascotHeight = mascotWidth;
  const mascotX = Math.round(options.mascotX ?? width - mascotWidth - width * 0.04);
  const mascotY = Math.round(options.mascotY ?? height - mascotHeight - height * 0.03);
  const copy = escapeXml(plan.copy);

  const background = options.backgroundUrl
    ? `<image href="${escapeXml(options.backgroundUrl)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`
    : '';
  const bubble = plan.bubble === 'none'
    ? ''
    : `<g transform="translate(${Math.round(width * 0.06)} ${Math.round(height * 0.08)})">
        <rect x="0" y="0" width="${Math.min(width * 0.56, 720)}" height="${Math.min(height * 0.22, 190)}" rx="28" fill="#fffdf7" stroke="#201a17" stroke-width="6"/>
        ${plan.bubble === 'thought' ? '<circle cx="28" cy="205" r="14" fill="#fffdf7" stroke="#201a17" stroke-width="5"/><circle cx="3" cy="235" r="8" fill="#fffdf7" stroke="#201a17" stroke-width="4"/>' : '<path d="M90 190 L55 240 L150 192" fill="#fffdf7" stroke="#201a17" stroke-width="6"/>'}
        <text x="28" y="64" fill="#201a17" font-family="Arial, sans-serif" font-size="28" font-weight="700">${copy}</text>
      </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${background}
    ${bubble}
    <image href="${escapeXml(plan.assetUrl)}" x="${mascotX}" y="${mascotY}" width="${mascotWidth}" height="${mascotHeight}" preserveAspectRatio="xMidYMax meet"/>
  </svg>`;
}

export function bigfootPoseAssetKeys(version = DEFAULT_VERSION): Record<BigfootPose, string> {
  return Object.fromEntries(
    Object.entries(POSE_ASSET_KEYS).map(([pose, key]) => [pose, key.replace('/v1/', `/${version}/`)]),
  ) as Record<BigfootPose, string>;
}
