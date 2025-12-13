/**
 * Utility functions for KiamichiBizConnect
 */

/**
 * Extracts Facebook page ID or username from various Facebook URL formats
 * and returns a Graph API picture URL
 */
export function getFacebookImageUrl(facebookUrl: string, width: number = 600, height: number = 400): string {
  if (!facebookUrl) return '';

  try {
    // Remove trailing slash
    const url = facebookUrl.replace(/\/$/, '');

    // Pattern 1: https://www.facebook.com/USERNAME
    const usernameMatch = url.match(/facebook\.com\/([^/?]+)$/);
    if (usernameMatch && usernameMatch[1] !== 'profile.php' && usernameMatch[1] !== 'p') {
      return `https://graph.facebook.com/${usernameMatch[1]}/picture?type=large&width=${width}&height=${height}`;
    }

    // Pattern 2: https://www.facebook.com/profile.php?id=12345
    const profileIdMatch = url.match(/profile\.php\?id=(\d+)/);
    if (profileIdMatch) {
      return `https://graph.facebook.com/${profileIdMatch[1]}/picture?type=large&width=${width}&height=${height}`;
    }

    // Pattern 3: https://www.facebook.com/p/Page-Name-12345/
    const pPageMatch = url.match(/facebook\.com\/p\/[^-]+-(\d+)/);
    if (pPageMatch) {
      return `https://graph.facebook.com/${pPageMatch[1]}/picture?type=large&width=${width}&height=${height}`;
    }

    // Fallback: try to extract any number that might be an ID
    const anyIdMatch = url.match(/(\d{10,})/);
    if (anyIdMatch) {
      return `https://graph.facebook.com/${anyIdMatch[1]}/picture?type=large&width=${width}&height=${height}`;
    }

    // If all else fails, return empty string (will fall back to icon)
    return '';
  } catch (error) {
    console.error('Error parsing Facebook URL:', error);
    return '';
  }
}

/**
 * Generate slug from business name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
