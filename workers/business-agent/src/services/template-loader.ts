import type { ComponentTemplate, TemplateCacheEntry } from "./types";

/**
 * TemplateLoader
 *
 * Loads component templates from R2 bucket and provides in-memory caching
 * to minimize R2 requests and improve performance.
 *
 * Template Key Format: {component_type}-{variant}.json
 * Example: hero-modern.json, footer-standard.json
 */
export class TemplateLoader {
  private cache: Map<string, TemplateCacheEntry> = new Map();
  private bucket: R2Bucket;

  constructor(bucket: R2Bucket) {
    this.bucket = bucket;
  }

  /**
   * Load a component template from R2 bucket with caching
   *
   * @param componentType - Type of component (e.g., "hero", "footer")
   * @param variant - Style variant (e.g., "modern", "minimal")
   * @returns Component template object
   * @throws Error if template not found
   */
  async loadTemplate(
    componentType: string,
    variant: string
  ): Promise<ComponentTemplate> {
    const key = this.getTemplateKey(componentType, variant);

    // Check cache first
    const cached = this.cache.get(key);
    if (cached) {
      return cached.template;
    }

    // Load from R2
    const object = await this.bucket.get(key);

    if (!object) {
      throw new Error(
        `Template not found: ${componentType}-${variant} (key: ${key})`
      );
    }

    // Parse template JSON
    const template = await object.json<ComponentTemplate>();

    // Cache the template
    this.cache.set(key, {
      template,
      cachedAt: Date.now(),
    });

    return template;
  }

  /**
   * Generate R2 key for a component template
   *
   * @param componentType - Type of component
   * @param variant - Style variant
   * @returns R2 object key
   */
  getTemplateKey(componentType: string, variant: string): string {
    return `${componentType}-${variant}.json`;
  }

  /**
   * Clear the in-memory template cache
   * Useful for development or when templates are updated
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size (for monitoring/debugging)
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Check if a template is cached
   */
  isCached(componentType: string, variant: string): boolean {
    const key = this.getTemplateKey(componentType, variant);
    return this.cache.has(key);
  }
}
