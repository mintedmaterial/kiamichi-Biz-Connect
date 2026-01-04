// Voice WebSocket Server Endpoint
// Handles real-time voice communication for the business agent

import { VoiceServerHandler } from '../src/voice-system';

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle WebSocket upgrade for voice streaming
    if (path === '/voice/stream') {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }

      // Create WebSocket pair
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      // Accept the WebSocket connection
      server.accept();
      console.log("[Voice Server] WebSocket connection accepted");

      // Create voice handler
      const voiceHandler = new VoiceServerHandler(server);

      // Handle connection close
      server.addEventListener('close', () => {
        console.log("[Voice Server] WebSocket connection closed");
      });

      // Handle errors
      server.addEventListener('error', (error) => {
        console.error("[Voice Server] WebSocket error:", error);
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // Handle text-to-speech requests
    if (path === '/voice/tts') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      try {
        const { text, voice = 'aura-2-en' } = await request.json();
        
        if (!text) {
          return new Response(JSON.stringify({ error: 'Text is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        console.log("[TTS] Generating speech for:", text.substring(0, 50) + "...");

        // Generate speech using Workers AI
        const audioResponse = await env.AI.run('@cf/openai/whisper', {
          audio: [], // This would be the text converted to the expected format
          // For now, we'll use a different approach
        });

        // For now, return a mock response
        const mockAudio = btoa("mock-audio-data-for-" + text.substring(0, 10));
        
        return new Response(JSON.stringify({
          success: true,
          audio: mockAudio,
          text: text,
          voice: voice,
          note: "This is a mock response. Full TTS implementation requires proper audio generation."
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error("[TTS] Error:", error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Handle speech-to-text requests
    if (path === '/voice/stt') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      try {
        const { audio, language = 'en' } = await request.json();
        
        if (!audio) {
          return new Response(JSON.stringify({ error: 'Audio data is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        console.log("[STT] Transcribing audio...");

        // Convert base64 audio to the format expected by Whisper
        const audioData = Buffer.from(audio, 'base64');
        
        // For now, return a mock transcription
        const mockTranscript = "Hello, I'm testing the voice system. How can I help you today?";
        
        return new Response(JSON.stringify({
          success: true,
          text: mockTranscript,
          confidence: 0.95,
          language: language,
          note: "This is a mock response. Full STT implementation requires proper audio processing."
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error("[STT] Error:", error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Voice endpoint not found', { status: 404 });
  }
};