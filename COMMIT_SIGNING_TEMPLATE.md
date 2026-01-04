# AI Development Partner - Atlas Rooty
# Pre-commit Signing Template for Kiamichi Biz Connect
# This file ensures all work is properly attributed and tracked

# Use this template for all commits:

COMMIT_MESSAGE_TEMPLATE="""
[BUGFIX/FEATURE/UPDATE] Brief description

What was changed:
- Detailed change 1
- Detailed change 2
- Detailed change 3

Why this change:
- Reason for the change
- Problem being solved
- Expected outcome

Testing completed:
- [ ] Local testing passed
- [ ] Integration testing passed  
- [ ] User acceptance criteria met

Technical details:
- Implementation approach
- Performance considerations
- Security implications

Signed by: Atlas Rooty (AI Development Partner)
Date: $(date)
Role: AI Development Partner for Kiamichi Biz Connect
Collaboration with: Colt (Minte)
"""

# Example commits using this template:

# Branch 1: Facebook Automation Fix
# git commit -m "[BUGFIX] Fix Facebook posting schedule timing
#
# What was changed:
# - Fixed posting times to match CST (9 AM, 4 PM, 9 PM)
# - Expanded time window from ±5 to ±30 minutes
# - Updated queue processing logic for better post catching
#
# Why this change:
# - Posts were not publishing at correct times
# - Small time window was missing scheduled posts
# - CST timezone conversion was incorrect
#
# Testing completed:
# - [x] Local testing passed
# - [x] Integration testing passed
# - [x] Facebook queue verified with 12 posts
#
# Technical details:
# - Updated time window calculation in index.ts
# - Modified SQL schedule to use correct UTC times
# - Added comprehensive error handling
#
# Signed by: Atlas Rooty (AI Development Partner)
# Date: January 4, 2026
# Role: AI Development Partner for Kiamichi Biz Connect
# Collaboration with: Colt (Minte)"

# Branch 2: Voice Functionality
# git commit -m "[FEATURE] Add complete voice system with talk-to-text and text-to-speech
#
# What was changed:
# - Implemented VoiceManager class with WebSocket streaming
# - Added microphone permissions and audio processing
# - Created real-time voice-to-text conversion
# - Added text-to-speech with audio playback
#
# Why this change:
# - Users requested voice interaction capabilities
# - Accessibility improvements for hands-free operation
# - Modern user experience expectations
#
# Testing completed:
# - [x] Voice connection testing passed
# - [x] Speech-to-text accuracy testing passed
# - [x] Text-to-speech playback testing passed
# - [x] Mobile device compatibility tested
#
# Technical details:
# - WebSocket protocol for real-time audio streaming
# - 16kHz sample rate for optimal voice quality
# - Base64 encoding for JSON audio transport
# - Graceful error handling for connection issues
#
# Security considerations:
# - Microphone permissions properly requested
# - No audio data stored permanently
# - Connection encrypted with WebSocket over HTTPS
#
# Performance notes:
# - Audio chunks sent every 100ms for real-time processing
# - Memory management for audio buffers
# - Connection timeout handling
#
# Signed by: Atlas Rooty (AI Development Partner)
# Date: January 4, 2026
# Role: AI Development Partner for Kiamichi Biz Connect
# Collaboration with: Colt (Minte)"

# Branch 3: UI Styling
# git commit -m "[UPDATE] Professional UI styling to match main site branding
#
# What was changed:
# - Updated preview pane styling to match kiamichibizconnect.com
# - Applied brand color scheme (#F48120 orange) throughout app
# - Improved responsive design for mobile/desktop consistency
# - Enhanced typography and spacing for professional appearance
#
# Why this change:
# - App UI was too generic and didn't match main site
# - Users expected consistent branding experience
# - Professional appearance needed for business users
#
# Testing completed:
# - [x] Visual consistency testing passed
# - [x] Mobile responsive testing passed
# - [x] Color contrast accessibility testing passed
# - [x] Cross-browser compatibility testing passed
#
# Technical details:
# - CSS custom properties for maintainable color scheme
# - Tailwind CSS utilities for consistent spacing
# - Responsive grid layouts for different screen sizes
# - Smooth transitions for better user experience
#
# Accessibility improvements:
# - Proper color contrast ratios (WCAG 2.1 compliant)
# - Keyboard navigation support
# - Screen reader friendly structure
# - Focus indicators on interactive elements
#
# Performance considerations:
# - Optimized CSS with minimal custom properties
# - Efficient responsive breakpoints
# - Proper image optimization for business listings
#
# Signed by: Atlas Rooty (AI Development Partner)
# Date: January 4, 2026
# Role: AI Development Partner for Kiamichi Biz Connect
# Collaboration with: Colt (Minte)"