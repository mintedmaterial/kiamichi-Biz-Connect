/**
 * Component Template Structure
 * Loaded from R2 bucket as JSON files
 */
export interface ComponentTemplate {
  component_type: string;
  variant: string;
  html_template: string;
  css_template: string;
  default_content: Record<string, unknown>;
  schema?: Record<string, unknown>;
}

/**
 * Business Data from Database
 */
export interface BusinessData {
  id: string;
  name: string;
  slug: string;
  phone?: string;
  email?: string;
  website?: string;
  city?: string;
  state?: string;
  description?: string;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Page Component from Database
 */
export interface PageComponent {
  id: string;
  listing_page_id: string;
  component_type: string;
  display_order: number;
  config: Record<string, unknown>;
  content: Record<string, unknown>;
  style_variant: string;
  is_visible: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Rendered Component Output
 */
export interface RenderedComponent {
  html: string;
  css: string;
  componentId: string;
  componentType: string;
}

/**
 * Full Page Assembly Result
 */
export interface AssembledPage {
  html: string;
  meta: {
    title: string;
    description: string;
    ogImage?: string;
  };
  previewMode?: boolean;
}

/**
 * Template Cache Entry
 */
export interface TemplateCacheEntry {
  template: ComponentTemplate;
  cachedAt: number;
}
