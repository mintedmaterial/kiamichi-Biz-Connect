/**
 * Example Usage of Component Rendering System
 *
 * This file demonstrates how to integrate the rendering system
 * into your Cloudflare Worker for business listing pages.
 */

import { TemplateLoader, ComponentRenderer, PageAssembler } from "./index";

/**
 * Example 1: Render a Single Page
 *
 * Basic usage for rendering a business listing page
 */
export async function renderListingPage(
  env: {
    DB: D1Database;
    TEMPLATES: R2Bucket;
  },
  listingPageId: string,
  previewMode = false
): Promise<Response> {
  // Initialize services
  const templateLoader = new TemplateLoader(env.TEMPLATES);
  const componentRenderer = new ComponentRenderer();
  const pageAssembler = new PageAssembler(
    env.DB,
    templateLoader,
    componentRenderer
  );

  try {
    // Assemble the page
    const result = await pageAssembler.assemblePage(listingPageId, {
      previewMode,
    });

    // Return HTML response
    return new Response(result.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": previewMode
          ? "no-store, no-cache, must-revalidate"
          : "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error rendering page:", error);
    return new Response("Page not found", { status: 404 });
  }
}

/**
 * Example 2: Worker Fetch Handler Integration
 *
 * How to integrate page rendering into your Worker's fetch handler
 */
export default {
  async fetch(
    request: Request,
    env: {
      DB: D1Database;
      TEMPLATES: R2Bucket;
    }
  ): Promise<Response> {
    const url = new URL(request.url);

    // Route: /page/:slug
    const pageMatch = url.pathname.match(/^\/page\/([^/]+)$/);
    if (pageMatch) {
      const slug = pageMatch[1];

      // Fetch listing page ID from database
      const page = await env.DB.prepare(
        "SELECT id FROM listing_pages WHERE slug = ?"
      )
        .bind(slug)
        .first<{ id: string }>();

      if (!page) {
        return new Response("Page not found", { status: 404 });
      }

      // Check for preview mode
      const previewMode = url.searchParams.get("preview") === "true";

      // Render the page
      return renderListingPage(env, page.id, previewMode);
    }

    // Route: /preview/:pageId
    const previewMatch = url.pathname.match(/^\/preview\/([^/]+)$/);
    if (previewMatch) {
      const pageId = previewMatch[1];
      return renderListingPage(env, pageId, true);
    }

    return new Response("Not found", { status: 404 });
  },
};

/**
 * Example 3: API Endpoint for Preview
 *
 * JSON API that returns preview HTML for chat interface
 */
export async function getPagePreview(
  env: {
    DB: D1Database;
    TEMPLATES: R2Bucket;
  },
  listingPageId: string
): Promise<Response> {
  const templateLoader = new TemplateLoader(env.TEMPLATES);
  const componentRenderer = new ComponentRenderer();
  const pageAssembler = new PageAssembler(
    env.DB,
    templateLoader,
    componentRenderer
  );

  try {
    const result = await pageAssembler.assemblePage(listingPageId, {
      previewMode: true,
    });

    return new Response(
      JSON.stringify({
        html: result.html,
        meta: result.meta,
        previewUrl: `/preview/${listingPageId}`,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to generate preview",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}

/**
 * Example 4: Scheduled Worker for Pre-rendering Pages
 *
 * Use a cron trigger to pre-render popular pages and cache in KV
 */
export async function preRenderPopularPages(env: {
  DB: D1Database;
  TEMPLATES: R2Bucket;
  CACHE: KVNamespace;
}): Promise<void> {
  const templateLoader = new TemplateLoader(env.TEMPLATES);
  const componentRenderer = new ComponentRenderer();
  const pageAssembler = new PageAssembler(
    env.DB,
    templateLoader,
    componentRenderer
  );

  // Fetch top 100 most viewed pages
  const pages = await env.DB.prepare(
    `SELECT id, slug FROM listing_pages
     ORDER BY view_count DESC
     LIMIT 100`
  ).all<{ id: string; slug: string }>();

  // Render and cache each page
  for (const page of pages.results || []) {
    try {
      const result = await pageAssembler.assemblePage(page.id);

      // Store in KV with 1 hour TTL
      await env.CACHE.put(`page:${page.slug}`, result.html, {
        expirationTtl: 3600,
      });

      console.log(`Pre-rendered page: ${page.slug}`);
    } catch (error) {
      console.error(`Failed to pre-render ${page.slug}:`, error);
    }
  }
}

/**
 * Example 5: AI Tool Integration
 *
 * Tool for AI agent to preview page changes
 */
export const previewPageTool = {
  name: "preview_listing_page",
  description:
    "Generate a preview of the business listing page with current components",
  parameters: {
    type: "object",
    properties: {
      listingPageId: {
        type: "string",
        description: "The ID of the listing page to preview",
      },
    },
    required: ["listingPageId"],
  },
  async execute(
    args: { listingPageId: string },
    env: {
      DB: D1Database;
      TEMPLATES: R2Bucket;
    }
  ) {
    const templateLoader = new TemplateLoader(env.TEMPLATES);
    const componentRenderer = new ComponentRenderer();
    const pageAssembler = new PageAssembler(
      env.DB,
      templateLoader,
      componentRenderer
    );

    const result = await pageAssembler.assemblePage(args.listingPageId, {
      previewMode: true,
    });

    return {
      success: true,
      previewUrl: `/preview/${args.listingPageId}`,
      meta: result.meta,
      componentCount: result.html.match(/data-component/g)?.length || 0,
    };
  },
};

/**
 * Example 6: Custom Business Slug Route
 *
 * Serve pages at custom domains like business-name.kiamichibizconnect.com
 */
export async function renderCustomDomainPage(
  env: {
    DB: D1Database;
    TEMPLATES: R2Bucket;
  },
  hostname: string
): Promise<Response> {
  // Extract subdomain
  const subdomain = hostname.split(".")[0];

  // Find business by slug
  const business = await env.DB.prepare(
    `SELECT lp.id as page_id
     FROM businesses b
     INNER JOIN listing_pages lp ON lp.business_id = b.id
     WHERE b.slug = ?`
  )
    .bind(subdomain)
    .first<{ page_id: string }>();

  if (!business) {
    return new Response("Business not found", { status: 404 });
  }

  return renderListingPage(env, business.page_id, false);
}
