/**
 * Facebook GraphQL API for posting
 * Uses the same API endpoints that Facebook's web interface uses
 */

interface SessionState {
  cookies: any[];
  cookieString: string;
  fb_dtsg?: string;
  userId?: string;
  lsd?: string;
  loginTime: number;
  expiresAt: number;
  isLoggedIn: boolean;
}

/**
 * Post to Facebook using GraphQL API (same as browser does)
 * More reliable than browser automation
 */
export async function postViaGraphQL(
  message: string,
  target: 'profile' | 'group',
  session: SessionState,
  env: {
    FB_PROFILE_ID: string;
    FB_GROUP_ID: string;
  }
): Promise<{ success: boolean; post_id?: string; error?: string }> {

  console.log('[GraphQL] Session tokens check:');
  console.log('[GraphQL] - fb_dtsg:', session.fb_dtsg ? 'present' : 'MISSING');
  console.log('[GraphQL] - userId:', session.userId ? session.userId : 'MISSING');
  console.log('[GraphQL] - lsd:', session.lsd ? 'present' : 'missing (will use fb_dtsg)');

  if (!session.fb_dtsg || !session.userId) {
    return {
      success: false,
      error: 'Missing required tokens (fb_dtsg or userId)'
    };
  }

  try {
    // Generate unique session ID for this post
    const composerSessionId = crypto.randomUUID();

    // Build variables for ComposerStoryCreateMutation
    // Based on actual working Chrome network trace from user
    // Simplified to minimum required fields
    const variables = {
      input: {
        composer_entry_point: 'inline_composer',
        composer_source_surface: target === 'group' ? 'group' : 'timeline',
        composer_type: target === 'group' ? 'group' : 'timeline',
        source: 'WWW',
        message: {
          ranges: [],
          text: message
        },
        with_tags_ids: null,
        inline_activities: [],
        text_format_preset_id: '0',
        logging: {
          composer_session_id: composerSessionId
        },
        navigation_data: {
          attribution_id_v2: target === 'group'
            ? `CometGroupDiscussionRoot.react,comet.group,via_cold_start,${Date.now()},0,0,,`
            : `ProfileCometTimelineListViewRoot.react,comet.profile.timeline.list,unexpected,${Date.now()},0,0,,`
        },
        tracking: [null],
        event_share_metadata: {
          surface: target === 'group' ? 'group' : 'newsfeed'
        },
        actor_id: session.userId,
        client_mutation_id: Date.now().toString(),
        ...(target === 'group' ? {
          audience: {
            to_id: env.FB_GROUP_ID
          }
        } : {
          audience: {
            privacy: {
              allow: [],
              base_state: 'EVERYONE',
              deny: [],
              tag_expansion_state: 'UNSPECIFIED'
            }
          }
        })
      },
      feedLocation: target === 'group' ? 'GROUP' : 'TIMELINE',
      feedbackSource: target === 'group' ? 0 : 1,
      focusCommentID: null,
      gridMediaWidth: null,
      groupID: target === 'group' ? env.FB_GROUP_ID : null,
      scale: 1,
      privacySelectorRenderLocation: 'COMET_STREAM',
      renderLocation: target === 'group' ? 'group' : 'timeline',
      useDefaultActor: false,
      inviteShortLinkKey: null,
      isFeed: target === 'profile',
      isFundraiser: false,
      isFunFactPost: false,
      isGroup: target === 'group',
      isEvent: false,
      isTimeline: target === 'profile',
      isSocialLearning: false,
      isPageNewsFeed: false,
      isProfileReviews: false,
      isWorkSharedDraft: false,
      hashtag: null,
      canUserManageOffers: false
    };

    // Build form data (Facebook uses application/x-www-form-urlencoded)
    const formData = new URLSearchParams();
    formData.append('av', session.userId);
    formData.append('__aaid', '0');
    formData.append('__user', session.userId);
    formData.append('__a', '1');
    formData.append('__req', '1');
    formData.append('__hs', '19900.HYP:comet_pkg.2.1...0');
    formData.append('dpr', '1');
    formData.append('__ccg', 'EXCELLENT');
    formData.append('__rev', '1031489195');
    formData.append('__s', 'abcdef:ghijkl:mnopqr');
    formData.append('__hsi', Date.now().toString());
    formData.append('__dyn', '');
    formData.append('__csr', '');
    formData.append('__comet_req', '15');
    formData.append('fb_dtsg', session.fb_dtsg);
    formData.append('jazoest', '25598');
    formData.append('lsd', session.lsd || session.fb_dtsg); // Use fb_dtsg as fallback
    formData.append('__spin_r', '1031489195');
    formData.append('__spin_b', 'trunk');
    formData.append('__spin_t', Math.floor(Date.now() / 1000).toString());
    formData.append('fb_api_caller_class', 'RelayModern');
    formData.append('fb_api_req_friendly_name', 'ComposerStoryCreateMutation');
    formData.append('variables', JSON.stringify(variables));
    formData.append('server_timestamps', 'true');
    formData.append('doc_id', '25312274141763468'); // ComposerStoryCreateMutation

    console.log('[GraphQL] Posting to Facebook GraphQL API');
    console.log('[GraphQL] Target:', target);
    console.log('[GraphQL] Message length:', message.length);
    console.log('[GraphQL] Variables:', JSON.stringify(variables).substring(0, 500));

    // Make GraphQL request
    const response = await fetch('https://www.facebook.com/api/graphql/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': session.cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://www.facebook.com',
        'Referer': target === 'group'
          ? `https://www.facebook.com/groups/${env.FB_GROUP_ID}`
          : 'https://www.facebook.com/',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-ASBD-ID': '359341',
        'X-FB-Friendly-Name': 'ComposerStoryCreateMutation',
        'X-FB-LSD': session.lsd || session.fb_dtsg,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
      },
      body: formData.toString()
    });

    console.log('[GraphQL] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GraphQL] Error response:', errorText.substring(0, 500));
      return {
        success: false,
        error: `GraphQL API error: ${response.status} ${response.statusText}`
      };
    }

    const responseText = await response.text();
    console.log('[GraphQL] Response preview:', responseText.substring(0, 500));

    // Try to parse response
    let responseData: any;
    try {
      // Facebook sometimes returns multiple JSON objects, try to parse the first one
      const jsonMatch = responseText.match(/\{.*\}/s);
      if (jsonMatch) {
        responseData = JSON.parse(jsonMatch[0]);
      } else {
        responseData = JSON.parse(responseText);
      }
    } catch (e) {
      console.error('[GraphQL] Failed to parse response as JSON');
      // If it's HTML response, it likely succeeded (Facebook redirects on success)
      if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
        return {
          success: true,
          post_id: 'unknown',
          error: undefined
        };
      }
      return {
        success: false,
        error: 'Failed to parse GraphQL response'
      };
    }

    // Check for errors in response
    if (responseData.errors && responseData.errors.length > 0) {
      const error = responseData.errors[0];
      console.error('[GraphQL] API returned errors:', error);
      return {
        success: false,
        error: error.message || 'Unknown GraphQL error'
      };
    }

    // Extract post ID from response
    const storyId = responseData?.data?.story_create?.story?.id ||
                    responseData?.data?.story_create?.story?.legacy_story_id;

    console.log('[GraphQL] Post created successfully, ID:', storyId || 'unknown');

    return {
      success: true,
      post_id: storyId || 'unknown'
    };

  } catch (error: any) {
    console.error('[GraphQL] Request error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
