/**
 * API Route Handlers
 * RESTful endpoints for business agent frontend
 */
import { getBusinessContextFromSession } from "../utils/session";

/**
 * GET /api/my-business
 * Returns the authenticated user's business information
 */
export async function handleMyBusiness(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const businessContext = await getBusinessContextFromSession(
      request,
      env.DB
    );

    if (!businessContext) {
      return Response.json(
        {
          error: "No business found",
          message:
            "You don't have any verified businesses. Please claim a business first."
        },
        { status: 404 }
      );
    }

    // Get additional business details
    const business = await env.DB.prepare(
      `
      SELECT
        b.id,
        b.name,
        b.slug,
        b.description,
        b.phone,
        b.email,
        b.website,
        b.category_id,
        lp.id as listing_page_id,
        lp.is_published,
        lp.seo_title,
        lp.seo_description
      FROM businesses b
      LEFT JOIN listing_pages lp ON b.id = lp.business_id
      WHERE b.id = ?
    `
    )
      .bind(businessContext.businessId)
      .first();

    if (!business) {
      return Response.json(
        {
          error: "Business not found",
          message: "The business record could not be found."
        },
        { status: 404 }
      );
    }

    return Response.json({
      businessId: business.id,
      name: business.name,
      slug: business.slug,
      description: business.description,
      phone: business.phone,
      email: business.email,
      website: business.website,
      categoryId: business.category_id,
      listingPageId: business.listing_page_id,
      isPublished: business.is_published === 1,
      seoTitle: business.seo_title,
      seoDescription: business.seo_description,
      previewUrl: `/preview/${business.id}`,
      liveUrl: `https://kiamichibizconnect.com/business/${business.slug}`
    });
  } catch (error) {
    console.error("[API] Error fetching my business:", error);
    return Response.json(
      {
        error: "Internal server error",
        message: String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/publish
 * Publishes the current draft changes
 */
export async function handlePublish(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const businessContext = await getBusinessContextFromSession(
      request,
      env.DB
    );

    if (!businessContext) {
      return Response.json(
        {
          error: "Unauthorized",
          message: "No business found for this session."
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json<{ createSnapshot?: boolean }>();
    const createSnapshot = body.createSnapshot !== false; // Default to true

    // Get listing page
    const listingPage = await env.DB.prepare(
      `
      SELECT id FROM listing_pages
      WHERE business_id = ?
    `
    )
      .bind(businessContext.businessId)
      .first();

    if (!listingPage) {
      return Response.json(
        {
          error: "No listing page",
          message: "No listing page found for this business."
        },
        { status: 404 }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Create snapshot if requested
    if (createSnapshot) {
      // Get all current components
      const { results: components } = await env.DB.prepare(
        `
        SELECT id, component_type, style_variant, display_order, content, config, is_visible
        FROM page_components
        WHERE listing_page_id = ?
        ORDER BY display_order ASC
      `
      )
        .bind(listingPage.id)
        .all();

      // Create snapshot
      const snapshotData = {
        components: components || [],
        createdAt: now,
        reason: "Pre-publish snapshot"
      };

      await env.DB.prepare(
        `
        INSERT INTO page_snapshots (listing_page_id, snapshot_data, created_at, created_by)
        VALUES (?, ?, ?, ?)
      `
      )
        .bind(
          listingPage.id,
          JSON.stringify(snapshotData),
          now,
          businessContext.ownerId
        )
        .run();

      console.log(
        `[Publish] Created snapshot for listing page ${listingPage.id}`
      );
    }

    // Mark listing page as published
    await env.DB.prepare(
      `
      UPDATE listing_pages
      SET is_published = 1, updated_at = ?
      WHERE id = ?
    `
    )
      .bind(now, listingPage.id)
      .run();

    console.log(`[Publish] Published listing page ${listingPage.id}`);

    return Response.json({
      success: true,
      message: "Changes published successfully",
      businessId: businessContext.businessId,
      listingPageId: listingPage.id,
      snapshotCreated: createSnapshot,
      publishedAt: now
    });
  } catch (error) {
    console.error("[API] Error publishing:", error);
    return Response.json(
      {
        error: "Publish failed",
        message: String(error)
      },
      { status: 500 }
    );
  }
}
