import type {
  AssembledPage,
  BusinessData,
  PageComponent,
  RenderedComponent,
} from "./types";
import { TemplateLoader } from "./template-loader";
import { ComponentRenderer } from "./component-renderer";

/**
 * PageAssembler Options
 */
interface PageAssemblerOptions {
  previewMode?: boolean;
}

/**
 * PageAssembler
 *
 * Orchestrates the full page assembly process:
 * 1. Fetches components from D1 database
 * 2. Loads business data
 * 3. Renders each component via ComponentRenderer
 * 4. Assembles complete HTML page with meta tags, CSS, and structure
 *
 * Outputs production-ready HTML pages for business listing pages.
 */
export class PageAssembler {
  private db: D1Database;
  private templateLoader: TemplateLoader;
  private componentRenderer: ComponentRenderer;

  constructor(
    db: D1Database,
    templateLoader: TemplateLoader,
    componentRenderer: ComponentRenderer
  ) {
    this.db = db;
    this.templateLoader = templateLoader;
    this.componentRenderer = componentRenderer;
  }

  /**
   * Assemble a complete HTML page for a listing page
   *
   * @param listingPageId - ID of the listing page
   * @param options - Assembly options (preview mode, etc.)
   * @returns Complete assembled page with HTML and metadata
   */
  async assemblePage(
    listingPageId: string,
    options: PageAssemblerOptions = {}
  ): Promise<AssembledPage> {
    // Fetch business data
    const business = await this.getBusinessByListingPageId(listingPageId);
    if (!business) {
      throw new Error(`Business not found for listing page: ${listingPageId}`);
    }

    // Fetch all visible components for this page, ordered by display_order
    const components = await this.getPageComponents(listingPageId);

    // Render all components
    const renderedComponents: RenderedComponent[] = [];
    for (const component of components) {
      const template = await this.templateLoader.loadTemplate(
        component.component_type,
        component.style_variant
      );

      const rendered = await this.componentRenderer.render(
        template,
        component,
        business
      );

      renderedComponents.push(rendered);
    }

    // Build meta tags
    const meta = {
      title: business.name,
      description: business.description || `Visit ${business.name} in ${business.city}, ${business.state}`,
      ogImage: business.image_url,
    };

    // Assemble final HTML
    const html = this.buildHTML(business, renderedComponents, meta, options.previewMode);

    return {
      html,
      meta,
      previewMode: options.previewMode,
    };
  }

  /**
   * Fetch all visible components for a listing page, ordered by display_order
   *
   * @param listingPageId - ID of the listing page
   * @returns Array of page components
   */
  private async getPageComponents(listingPageId: string): Promise<PageComponent[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM page_components
         WHERE listing_page_id = ? AND is_visible = 1
         ORDER BY display_order ASC`
      )
      .bind(listingPageId)
      .all<PageComponent>();

    return result.results || [];
  }

  /**
   * Fetch business data by listing page ID
   *
   * @param listingPageId - ID of the listing page
   * @returns Business data
   */
  async getBusinessByListingPageId(listingPageId: string): Promise<BusinessData> {
    // In a real implementation, you'd join through listing_pages table
    // For now, we'll fetch directly from businesses table
    const result = await this.db
      .prepare(
        `SELECT b.* FROM businesses b
         INNER JOIN listing_pages lp ON lp.business_id = b.id
         WHERE lp.id = ?`
      )
      .bind(listingPageId)
      .first<BusinessData>();

    if (!result) {
      throw new Error(`Business not found for listing page: ${listingPageId}`);
    }

    return result;
  }

  /**
   * Build complete HTML document
   *
   * @param business - Business data for meta tags
   * @param components - Rendered components
   * @param meta - Page metadata
   * @param previewMode - Whether to include preview banner
   * @returns Complete HTML document
   */
  private buildHTML(
    business: BusinessData,
    components: RenderedComponent[],
    meta: AssembledPage["meta"],
    previewMode?: boolean
  ): string {
    // Combine all component CSS
    const combinedCSS = components.map((c) => c.css).join("\n\n");

    // Combine all component HTML
    const combinedHTML = components.map((c) => c.html).join("\n");

    // Preview banner HTML
    const previewBanner = previewMode
      ? `
    <div style="background: #fbbf24; color: #000; padding: 1rem; text-align: center; font-weight: bold; position: sticky; top: 0; z-index: 9999;">
      This is a preview - Changes are not yet published
    </div>
    `
      : "";

    // Build complete HTML document
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(meta.title)}</title>
  <meta name="description" content="${this.escapeHtml(meta.description)}">

  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${this.escapeHtml(meta.title)}">
  <meta property="og:description" content="${this.escapeHtml(meta.description)}">
  ${meta.ogImage ? `<meta property="og:image" content="${this.escapeHtml(meta.ogImage)}">` : ""}
  <meta property="og:type" content="business.business">

  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${this.escapeHtml(meta.title)}">
  <meta name="twitter:description" content="${this.escapeHtml(meta.description)}">
  ${meta.ogImage ? `<meta name="twitter:image" content="${this.escapeHtml(meta.ogImage)}">` : ""}

  <!-- Component Styles -->
  <style>
    /* Reset and Base Styles */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }

    /* Component Styles */
    ${combinedCSS}
  </style>
</head>
<body>
  ${previewBanner}
  ${combinedHTML}
</body>
</html>`;
  }

  /**
   * Escape HTML special characters to prevent XSS
   *
   * @param text - Text to escape
   * @returns Escaped text
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}
