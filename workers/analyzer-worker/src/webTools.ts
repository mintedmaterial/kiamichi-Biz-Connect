/**
 * Web browsing and data extraction tools
 */

import { Business, Env } from './types';

/**
 * Browse web to find business information
 */
export async function browseWeb(
  business: Business,
  field: string,
  env: Env
): Promise<string> {
  // Try to fetch from business website first
  if (business.website) {
    try {
      const response = await fetch(business.website, {
        headers: {
          'User-Agent': 'KiamichiBizConnect-Bot/1.0 (Business Analyzer)'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (response.ok) {
        const html = await response.text();
        return html.substring(0, 50000); // Limit to 50KB
      }
    } catch (error) {
      console.warn(`Failed to fetch website for ${business.name}:`, error);
    }
  }

  // Try Facebook if we have a Facebook URL
  if (business.facebook_url && (field === 'description' || field === 'image_url' || field === 'hours')) {
    try {
      // Extract page ID from Facebook URL
      const pageId = extractFacebookPageId(business.facebook_url);

      if (pageId) {
        // Note: This would require a Facebook access token in production
        // For now, return a placeholder
        return JSON.stringify({
          source: 'facebook',
          pageId,
          note: 'Facebook data extraction requires valid access token'
        });
      }
    } catch (error) {
      console.warn(`Failed to extract Facebook data:`, error);
    }
  }

  return '';
}

/**
 * Extract data from web content
 */
export function extractDataFromWeb(
  webContent: string,
  field: string
): { value: string | null; confidence: number; source: string; sourceType: string } {
  if (!webContent || webContent.trim().length === 0) {
    return {
      value: null,
      confidence: 0,
      source: '',
      sourceType: 'none'
    };
  }

  // Field-specific extraction logic
  switch (field) {
    case 'phone':
      return extractPhone(webContent);

    case 'email':
      return extractEmail(webContent);

    case 'hours':
      return extractHours(webContent);

    case 'description':
      return extractDescription(webContent);

    case 'image_url':
      return extractImageUrl(webContent);

    default:
      return {
        value: null,
        confidence: 0,
        source: '',
        sourceType: 'unknown'
      };
  }
}

/**
 * Extract phone number from HTML content
 */
function extractPhone(html: string): { value: string | null; confidence: number; source: string; sourceType: string } {
  // Look for common phone number patterns
  const phonePatterns = [
    /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    /\d{3}[-.\s]\d{3}[-.\s]\d{4}/g
  ];

  for (const pattern of phonePatterns) {
    const matches = html.match(pattern);
    if (matches && matches.length > 0) {
      // Clean up the phone number
      const phone = matches[0].replace(/[^\d]/g, '');
      if (phone.length === 10) {
        return {
          value: `(${phone.substring(0, 3)}) ${phone.substring(3, 6)}-${phone.substring(6)}`,
          confidence: 0.85,
          source: 'website',
          sourceType: 'web_scrape'
        };
      }
    }
  }

  return { value: null, confidence: 0, source: '', sourceType: 'none' };
}

/**
 * Extract email from HTML content
 */
function extractEmail(html: string): { value: string | null; confidence: number; source: string; sourceType: string } {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = html.match(emailPattern);

  if (matches && matches.length > 0) {
    // Filter out common non-business emails
    const filtered = matches.filter(email =>
      !email.includes('example.com') &&
      !email.includes('test.com') &&
      !email.includes('placeholder')
    );

    if (filtered.length > 0) {
      return {
        value: filtered[0].toLowerCase(),
        confidence: 0.80,
        source: 'website',
        sourceType: 'web_scrape'
      };
    }
  }

  return { value: null, confidence: 0, source: '', sourceType: 'none' };
}

/**
 * Extract business hours from HTML content
 */
function extractHours(html: string): { value: string | null; confidence: number; source: string; sourceType: string } {
  // Look for common hours patterns
  const hoursPatterns = [
    /hours?:?\s*([^\n<]{10,100})/i,
    /open:?\s*([^\n<]{10,100})/i,
    /(mon|monday).*?(sun|sunday)[^\n<]{0,200}/i
  ];

  for (const pattern of hoursPatterns) {
    const match = html.match(pattern);
    if (match && match[0]) {
      const hours = match[0].replace(/<[^>]*>/g, '').trim();
      if (hours.length > 10 && hours.length < 200) {
        return {
          value: hours,
          confidence: 0.70,
          source: 'website',
          sourceType: 'web_scrape'
        };
      }
    }
  }

  return { value: null, confidence: 0, source: '', sourceType: 'none' };
}

/**
 * Extract description from HTML content
 */
function extractDescription(html: string): { value: string | null; confidence: number; source: string; sourceType: string } {
  // Look for meta description first
  const metaPattern = /<meta\s+name=["']description["']\s+content=["']([^"']{20,300})["']/i;
  const metaMatch = html.match(metaPattern);

  if (metaMatch && metaMatch[1]) {
    return {
      value: metaMatch[1].trim(),
      confidence: 0.90,
      source: 'website',
      sourceType: 'web_scrape'
    };
  }

  // Look for about/description sections
  const aboutPattern = /<(h[1-3]|div)[^>]*>about us<\/\1>[\s\S]{0,50}<p>([^<]{50,500})<\/p>/i;
  const aboutMatch = html.match(aboutPattern);

  if (aboutMatch && aboutMatch[2]) {
    return {
      value: aboutMatch[2].trim(),
      confidence: 0.75,
      source: 'website',
      sourceType: 'web_scrape'
    };
  }

  return { value: null, confidence: 0, source: '', sourceType: 'none' };
}

/**
 * Extract image URL from HTML content
 */
function extractImageUrl(html: string): { value: string | null; confidence: number; source: string; sourceType: string } {
  // Look for og:image meta tag first
  const ogPattern = /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i;
  const ogMatch = html.match(ogPattern);

  if (ogMatch && ogMatch[1]) {
    return {
      value: ogMatch[1],
      confidence: 0.95,
      source: 'website',
      sourceType: 'web_scrape'
    };
  }

  // Look for logo or hero images
  const imgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*(?:class|id)=["'][^"']*(?:logo|hero|banner)[^"']*["']/i;
  const imgMatch = html.match(imgPattern);

  if (imgMatch && imgMatch[1]) {
    return {
      value: imgMatch[1],
      confidence: 0.80,
      source: 'website',
      sourceType: 'web_scrape'
    };
  }

  return { value: null, confidence: 0, source: '', sourceType: 'none' };
}

/**
 * Extract Facebook page ID from URL
 */
function extractFacebookPageId(url: string): string | null {
  const patterns = [
    /facebook\.com\/([^\/\?]+)/,
    /fb\.com\/([^\/\?]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}
