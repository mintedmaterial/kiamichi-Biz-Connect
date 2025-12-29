-- Seed initial page components for SrvcFlo business (ID 373, listing_page_id 1)
-- Based on current static page layout from screenshot

-- Hero component
INSERT INTO page_components (
  listing_page_id,
  component_type,
  style_variant,
  display_order,
  content,
  is_visible
) VALUES (
  1,
  'hero',
  'modern',
  1,
  '{"heading":"SrvcFlo Web Marketing & Design","subheading":"Professional web marketing and design services","backgroundType":"gradient","cta":{"text":"Visit Website","url":"https://srvcflo.com"}}',
  1
);

-- About section
INSERT INTO page_components (
  listing_page_id,
  component_type,
  style_variant,
  display_order,
  content,
  is_visible
) VALUES (
  1,
  'about',
  'default',
  2,
  '{"heading":"About","description":"Professional web marketing and design services for Southeast Oklahoma businesses. We specialize in modern web design, SEO optimization, and digital marketing strategies."}',
  1
);

-- Contact info with form
INSERT INTO page_components (
  listing_page_id,
  component_type,
  style_variant,
  display_order,
  content,
  is_visible
) VALUES (
  1,
  'contact',
  'modern',
  3,
  '{"heading":"Get in Touch","phone":"555-123-4567","email":"info@srvcflo.com","showForm":true,"formFields":["name","email","phone","service","message"]}',
  1
);
