/**
 * Code Mode for Business Agent
 * 
 * Template-based execution for batch operations.
 * Export tools and templates for integration with chat.
 */

export { 
  BUSINESS_TEMPLATES, 
  executeTemplate,
  createBusinessTools,
  type TemplateName 
} from './templates';

/**
 * Available templates with descriptions (for LLM context)
 */
export const TEMPLATE_DESCRIPTIONS = {
  'refresh-content': 'Regenerate page content including taglines and descriptions',
  'optimize-seo': 'Update SEO metadata (title, description, keywords)',
  'schedule-social': 'Generate and schedule Facebook posts for the week',
  'audit-listing': 'Check listing completeness and get improvement suggestions'
};

/**
 * Get template info for LLM prompt
 */
export function getTemplateInfo(): string {
  return Object.entries(TEMPLATE_DESCRIPTIONS)
    .map(([name, desc]) => `- ${name}: ${desc}`)
    .join('\n');
}
