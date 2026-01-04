/**
 * Workflow Types for Social Media Post Creation
 */

export interface SocialPostParams {
  // Input parameters
  businessName: string;
  platform: "facebook" | "instagram" | "twitter";
  tone?: "professional" | "casual" | "friendly" | "promotional";
  includeHashtags?: boolean;
  target?: "page" | "group" | "both";

  // User info for approval
  userId: string;
  approvalDeadline?: Date;
}

export interface SocialPostDraftResult {
  success: boolean;
  businessId: number;
  businessName: string;
  postText: string;
  platform: string;
  message: string;
}

export interface SocialPostImageResult {
  success: boolean;
  imageUrl: string;
  imagePrompt: string;
  businessId: number;
  message: string;
}

export interface PublishResult {
  success: boolean;
  posted: number;
  failed: number;
  pagePostId?: string;
  groupPostId?: string;
  message: string;
}

export interface WorkflowState {
  currentStep: "draft" | "image" | "awaiting_approval" | "publishing" | "completed" | "failed";
  draft?: SocialPostDraftResult;
  image?: SocialPostImageResult;
  publishResult?: PublishResult;
  error?: string;
  approvedAt?: number;
  completedAt?: number;
}
