# Voice Agent Guide

## Overview

The Voice Agent enables real-time voice interactions with the Kiamichi Biz Connect AI assistant. Users can speak to the app and receive spoken responses, powered by advanced speech-to-text (STT) and text-to-speech (TTS) technology.

## Architecture

### STT/TTS Providers (Dual-Provider Strategy)

The Voice Agent uses a **primary + fallback** approach for reliability:

#### Primary: Cloudflare Workers AI
- **STT**: `@cf/openai/whisper-tiny-en`
- **TTS**: `@cf/cloudflare/aura-2-es`
- **Advantages**: Fast, serverless, no API keys needed
- **Location**: Runs on Cloudflare's global network

#### Fallback: HuggingFace ResembleAI
- **Model**: `ResembleAI/chatterbox-turbo-demo`
- **Used when**: Workers AI is unavailable or fails
- **Requires**: `HUGGINGFACE_API_KEY` environment variable

### Components

1. **VoiceAgent Durable Object** (`src/voice-agent.ts`)
   - WebSocket server for real-time audio streaming
   - Manages voice sessions
   - Handles STT → Chat Agent → TTS pipeline
   - Buffering and audio chunk processing

2. **Frontend UI** (`public/voice.html`)
   - Microphone capture using Web Audio API
   - WebSocket client for communication
   - Audio playback for responses
   - Visual feedback for connection/listening states

3. **Audio Processing Services**
   - `src/services/audio-source.ts` - Microphone input (browser-side)
   - `src/services/audio-sink.ts` - Speaker output (browser-side)

## Usage

### Accessing the Voice Interface

Navigate to: `https://app.kiamichibizconnect.com/voice.html`

### Steps to Use

1. **Connect**: Click the "Connect" button to establish WebSocket connection
2. **Start Listening**: Click "Start Listening" to begin voice input
   - Grant microphone permissions when prompted
3. **Speak**: Say your query clearly into the microphone
4. **Stop Listening**: Click "Stop Listening" when done speaking
5. **Receive Response**:
   - Your speech is transcribed and sent to the AI
   - AI response is converted to speech and played back

### Features

- **Real-time transcription**: See your words appear as you speak
- **Conversation history**: Track the full dialogue in the UI
- **Error handling**: Automatic fallback between providers
- **Audio quality**: 16kHz input, 24kHz output for clarity

## Configuration

### Environment Variables

Add to `.dev.vars` for local development:

```
HUGGINGFACE_API_KEY=hf_your_api_key_here
```

For production, set as Wrangler secret:

```bash
npx wrangler secret put HUGGINGFACE_API_KEY
```

### Wrangler Configuration

Already configured in `wrangler.jsonc`:

```jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "VoiceAgent",
        "class_name": "VoiceAgent"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v2",
      "new_sqlite_classes": ["VoiceAgent"]
    }
  ],
  "ai": {
    "binding": "AI"
  }
}
```

## Technical Details

### WebSocket Protocol

#### Client → Server Messages

```typescript
// Start listening
{ type: "start-listening" }

// Audio chunk (base64-encoded PCM 16-bit)
{
  type: "audio-chunk",
  audio: "base64_encoded_audio_data"
}

// Stop listening and process
{ type: "stop-listening" }

// Cancel listening
{ type: "cancel" }
```

#### Server → Client Messages

```typescript
// Session started
{
  type: "session-start",
  sessionId: "uuid",
  message: "Voice agent connected. Start speaking!"
}

// Listening state
{
  type: "listening",
  message: "Listening..."
}

// Transcript result
{
  type: "transcript",
  text: "transcribed text"
}

// Processing status
{
  type: "processing",
  message: "Converting speech to text..."
}

// AI text response
{
  type: "response-text",
  text: "AI response text"
}

// Audio response (base64-encoded WAV)
{
  type: "audio-response",
  audio: "base64_encoded_audio_data",
  format: "audio/wav"
}

// Completion
{
  type: "complete",
  message: "Response complete"
}

// Error
{
  type: "error",
  error: "error message"
}
```

### Audio Format Specifications

**Input (Microphone)**:
- Sample Rate: 16kHz
- Channels: Mono (1)
- Format: PCM 16-bit signed integer
- Buffer Size: 4096 samples

**Output (Speaker)**:
- Sample Rate: 24kHz (Workers AI TTS output)
- Format: WAV (decoded via Web Audio API)

### Processing Pipeline

```
User Speech
    ↓
[Microphone] → Float32Array
    ↓
[Audio Source] → PCM Int16Array → Base64
    ↓
[WebSocket] → VoiceAgent DO
    ↓
[STT: Workers AI/HuggingFace] → Text
    ↓
[Chat Agent] → AI Response Text
    ↓
[TTS: Workers AI/HuggingFace] → Audio
    ↓
[WebSocket] → Frontend
    ↓
[Audio Sink] → Speaker Output
```

## Deployment

### Local Development

```bash
cd workers/business-agent
npm install
npx wrangler dev
```

Visit: `http://localhost:8787/voice.html`

### Production Deployment

```bash
# Deploy to Cloudflare Workers
npx wrangler deploy

# Set production secrets
npx wrangler secret put HUGGINGFACE_API_KEY
```

Visit: `https://app.kiamichibizconnect.com/voice.html`

## Troubleshooting

### Microphone Access Denied

**Issue**: Browser blocks microphone access

**Solutions**:
- Grant microphone permissions in browser settings
- Use HTTPS (required for getUserMedia API)
- Check browser console for specific errors

### STT/TTS Errors

**Issue**: "All STT/TTS providers failed"

**Checks**:
1. Verify Workers AI binding is configured (`env.AI`)
2. Check `HUGGINGFACE_API_KEY` is set correctly
3. Review Cloudflare Workers AI quotas/limits
4. Check HuggingFace API status

### WebSocket Connection Fails

**Issue**: Cannot connect to voice agent

**Checks**:
1. Verify VoiceAgent DO is deployed
2. Check Wrangler routes configuration
3. Ensure `/voice/stream` endpoint is accessible
4. Review browser console for WebSocket errors

### Audio Playback Issues

**Issue**: Cannot hear AI responses

**Checks**:
1. Verify speaker/audio output is enabled
2. Check browser audio permissions
3. Ensure AudioContext is not suspended (user interaction required)
4. Review browser console for decodeAudioData errors

## Future Enhancements

- [ ] Support for multiple languages (STT/TTS)
- [ ] Voice activity detection (auto-stop when user stops speaking)
- [ ] Noise cancellation improvements
- [ ] Custom voice selection for TTS
- [ ] Voice authentication
- [ ] Real-time transcription streaming
- [ ] WebRTC integration for lower latency
- [ ] Support for Cloudflare Realtime SDK migration

## References

- [Cloudflare Workers AI - Whisper](https://developers.cloudflare.com/workers-ai/models/whisper/)
- [Cloudflare Workers AI - Aura TTS](https://developers.cloudflare.com/workers-ai/models/aura-2-es/)
- [HuggingFace - ResembleAI](https://huggingface.co/ResembleAI/chatterbox-turbo-demo)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [cloudflare-voicebots Reference](https://github.com/AshishKumar4/cloudflare-voicebots)
