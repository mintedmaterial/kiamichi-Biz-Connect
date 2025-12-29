/**
 * Voice Agent Durable Object
 * Handles real-time voice interactions using Deepgram API:
 * - STT (Speech-to-Text): Deepgram Nova-3 via WebSocket
 * - TTS (Text-to-Speech): Deepgram Aura (aura-asteria-en)
 * Based on: https://developers.deepgram.com/docs/
 */

import { DurableObject } from "cloudflare:workers";

interface VoiceSession {
  websocket: WebSocket;
  chatAgentId: string;
  isListening: boolean;
  audioBuffer: ArrayBuffer[];
  hasReceivedAudio?: boolean;
}

export class VoiceAgent extends DurableObject {
  private sessions: Map<string, VoiceSession> = new Map();
  private sttWebSockets: Map<string, WebSocket> = new Map();

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
  }

  /**
   * Handle incoming WebSocket connections for voice streaming
   */
  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      console.log(`[Voice] Fetch request: ${request.method} ${url.pathname}`);

      // WebSocket upgrade for voice streaming
      if (url.pathname === "/voice/stream" && request.headers.get("Upgrade") === "websocket") {
        console.log(`[Voice] WebSocket upgrade requested`);
        return this.handleWebSocketUpgrade(request);
      }

      // Health check
      if (url.pathname === "/voice/health") {
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      console.log(`[Voice] Path not found: ${url.pathname}`);
      return new Response("Not found", { status: 404 });
    } catch (error) {
      console.error("[Voice] Fetch error:", error);
      return new Response(`Internal error: ${error}`, { status: 500 });
    }
  }

  /**
   * Upgrade HTTP request to WebSocket for voice streaming
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    try {
      console.log(`[Voice] Creating WebSocket pair...`);
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      console.log(`[Voice] Accepting WebSocket connection...`);
      // Accept the WebSocket connection
      server.accept();

      // Generate session ID
      const sessionId = crypto.randomUUID();
      console.log(`[Voice] Session ID: ${sessionId}`);

      // Initialize session
      const session: VoiceSession = {
        websocket: server,
        chatAgentId: "default", // Use default chat agent room
        isListening: false,
        audioBuffer: []
      };

      this.sessions.set(sessionId, session);

      // Set up WebSocket event handlers
      server.addEventListener("message", async (event) => {
        try {
          await this.handleWebSocketMessage(sessionId, event);
        } catch (error) {
          console.error(`[Voice] Message handler error:`, error);
        }
      });

      server.addEventListener("close", () => {
        console.log(`[Voice] Session ${sessionId} closed`);
        this.sessions.delete(sessionId);
      });

      server.addEventListener("error", (error) => {
        console.error(`[Voice] Session ${sessionId} error:`, error);
        this.sessions.delete(sessionId);
      });

      console.log(`[Voice] New session created: ${sessionId}`);

      // Send welcome message
      server.send(JSON.stringify({
        type: "session-start",
        sessionId,
        message: "Voice agent connected. Start speaking!"
      }));

      console.log(`[Voice] Returning WebSocket response with status 101`);
      return new Response(null, {
        status: 101,
        webSocket: client
      });
    } catch (error) {
      console.error(`[Voice] WebSocket upgrade error:`, error);
      return new Response(`WebSocket upgrade failed: ${error}`, { status: 500 });
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleWebSocketMessage(sessionId: string, event: MessageEvent) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`[Voice] Session ${sessionId} not found`);
      return;
    }

    try {
      // Parse message
      const data = typeof event.data === "string"
        ? JSON.parse(event.data)
        : event.data;

      switch (data.type) {
        case "start-listening":
          session.isListening = true;
          session.audioBuffer = [];
          console.log(`[Voice] Session ${sessionId} started listening`);

          // Initialize real-time STT WebSocket
          await this.initializeRealtimeSTT(sessionId, session);

          session.websocket.send(JSON.stringify({
            type: "listening",
            message: "Listening..."
          }));
          break;

        case "audio-chunk":
          // Forward audio data directly to Deepgram WebSocket for real-time transcription
          if (session.isListening) {
            const sttWs = this.sttWebSockets.get(sessionId);
            if (sttWs && sttWs.readyState === WebSocket.OPEN) {
              const audioData = data.audio instanceof ArrayBuffer
                ? data.audio
                : this.base64ToArrayBuffer(data.audio);

              // Send raw PCM audio to Deepgram (linear16 format)
              sttWs.send(audioData);

              if (!session.hasReceivedAudio) {
                session.hasReceivedAudio = true;
                console.log("[Voice] First audio chunk sent to Deepgram, size:", audioData.byteLength, "bytes");
              }
            } else {
              console.warn("[Voice] Deepgram WebSocket not ready, state:", sttWs?.readyState);
            }
          }
          break;

        case "stop-listening":
          session.isListening = false;
          console.log(`[Voice] Session ${sessionId} stopped listening`);

          // Properly close Deepgram connection
          const sttWs = this.sttWebSockets.get(sessionId);
          if (sttWs && sttWs.readyState === WebSocket.OPEN) {
            // Send CloseStream message to Deepgram to finalize transcription
            sttWs.send(JSON.stringify({ type: "CloseStream" }));
            console.log("[Voice] Sent CloseStream to Deepgram");

            // Close the WebSocket
            sttWs.close();
            this.sttWebSockets.delete(sessionId);
          }
          break;

        case "cancel":
          session.isListening = false;
          session.audioBuffer = [];
          session.websocket.send(JSON.stringify({
            type: "cancelled",
            message: "Listening cancelled"
          }));
          break;

        default:
          console.warn(`[Voice] Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error(`[Voice] Error handling message:`, error);
      session.websocket.send(JSON.stringify({
        type: "error",
        error: String(error)
      }));
    }
  }

  /**
   * Initialize real-time STT using Deepgram API
   */
  private async initializeRealtimeSTT(sessionId: string, session: VoiceSession): Promise<void> {
    try {
      console.log(`[Voice] Initializing real-time STT with Deepgram for session ${sessionId}`);

      if (!this.env.DEEPGRAM_API_KEY) {
        throw new Error("DEEPGRAM_API_KEY not configured");
      }

      // Create WebSocket connection to Deepgram Live API
      // Using 48000 Hz to match browser's default AudioContext sample rate
      const deepgramUrl = new URL('https://api.deepgram.com/v1/listen');
      deepgramUrl.searchParams.set('model', 'nova-2');
      deepgramUrl.searchParams.set('language', 'en');
      deepgramUrl.searchParams.set('smart_format', 'true');
      deepgramUrl.searchParams.set('interim_results', 'false');
      deepgramUrl.searchParams.set('encoding', 'linear16');
      deepgramUrl.searchParams.set('sample_rate', '48000');
      deepgramUrl.searchParams.set('channels', '1');
      deepgramUrl.searchParams.set('endpointing', '300');

      // Add auth token as query parameter (Deepgram supports this)
      deepgramUrl.searchParams.set('token', this.env.DEEPGRAM_API_KEY);

      // Convert to WSS URL
      const wsUrl = deepgramUrl.toString().replace('https://', 'wss://');
      console.log(`[Voice] Connecting to Deepgram at`, wsUrl.replace(this.env.DEEPGRAM_API_KEY, 'REDACTED'));

      // Create standard WebSocket connection (no headers option in Workers)
      const sttWs = new WebSocket(wsUrl);

      this.sttWebSockets.set(sessionId, sttWs);

      let fullTranscript = "";
      let keepAliveInterval: NodeJS.Timeout | null = null;

      // Wait for connection to open before sending audio
      sttWs.addEventListener("open", () => {
        console.log(`[Voice] Deepgram WebSocket opened for session ${sessionId}`);

        // Send KeepAlive messages every 5 seconds to prevent timeout
        keepAliveInterval = setInterval(() => {
          if (sttWs.readyState === WebSocket.OPEN) {
            sttWs.send(JSON.stringify({ type: "KeepAlive" }));
          }
        }, 5000);
      });

      // Handle transcription events from Deepgram
      sttWs.addEventListener("message", async (event: MessageEvent) => {
        try {
          const result = JSON.parse(event.data as string);
          console.log("[Voice] Deepgram event:", JSON.stringify(result).substring(0, 200));

          // Deepgram response format
          // { channel: { alternatives: [{ transcript: "text" }] }, is_final: true, speech_final: true }
          if (result.channel?.alternatives?.[0]) {
            const transcript = result.channel.alternatives[0].transcript?.trim();

            // Only process final transcripts with actual content
            if (transcript && result.is_final && result.speech_final) {
              fullTranscript += (fullTranscript ? " " : "") + transcript;
              console.log("[Voice] Final transcript:", fullTranscript);

              // Send transcript to client
              session.websocket.send(JSON.stringify({
                type: "transcript",
                text: fullTranscript
              }));

              // Process with Chat Agent and get response
              session.websocket.send(JSON.stringify({
                type: "processing",
                message: "Processing your request..."
              }));

              const chatResponse = await this.sendToChatAgent(session.chatAgentId, fullTranscript);

              session.websocket.send(JSON.stringify({
                type: "response-text",
                text: chatResponse
              }));

              // Convert response to speech
              session.websocket.send(JSON.stringify({
                type: "processing",
                message: "Generating speech..."
              }));

              const audioResponse = await this.textToSpeech(chatResponse);

              // Send audio back
              session.websocket.send(JSON.stringify({
                type: "audio-response",
                audio: this.arrayBufferToBase64(audioResponse),
                format: "audio/mp3"
              }));

              session.websocket.send(JSON.stringify({
                type: "complete",
                message: "Response complete"
              }));

              // Reset transcript for next turn
              fullTranscript = "";
            }
          }
        } catch (error) {
          console.error("[Voice] STT message error:", error);
        }
      });

      sttWs.addEventListener("error", (error) => {
        console.error(`[Voice] Deepgram WebSocket error for session ${sessionId}:`, error);
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }
        session.websocket.send(JSON.stringify({
          type: "error",
          error: "Speech recognition error"
        }));
      });

      sttWs.addEventListener("close", (event) => {
        console.log(`[Voice] Deepgram WebSocket closed for session ${sessionId}, code: ${event.code}, reason: ${event.reason}`);
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }
        this.sttWebSockets.delete(sessionId);
      });

    } catch (error) {
      console.error("[Voice] Failed to initialize real-time STT:", error);
      session.websocket.send(JSON.stringify({
        type: "error",
        error: `Failed to initialize speech recognition: ${error}`
      }));
    }
  }

  /**
   * Process accumulated audio buffer (legacy - keeping for fallback)
   * 1. Convert speech to text using HuggingFace ResembleAI
   * 2. Send to Chat Agent for processing
   * 3. Convert response to speech
   * 4. Stream audio back to client
   */
  private async processAudio(sessionId: string, session: VoiceSession) {
    try {
      // Combine audio chunks
      const totalLength = session.audioBuffer.reduce((acc, chunk) => acc + chunk.byteLength, 0);
      const combinedAudio = new Uint8Array(totalLength);

      let offset = 0;
      for (const chunk of session.audioBuffer) {
        combinedAudio.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }

      console.log(`[Voice] Processing ${totalLength} bytes of audio`);

      session.websocket.send(JSON.stringify({
        type: "processing",
        message: "Converting speech to text..."
      }));

      // Step 1: Speech-to-Text using HuggingFace ResembleAI
      const transcript = await this.speechToText(combinedAudio);

      console.log(`[Voice] Transcript: ${transcript}`);

      session.websocket.send(JSON.stringify({
        type: "transcript",
        text: transcript
      }));

      // Step 2: Send to Chat Agent
      session.websocket.send(JSON.stringify({
        type: "processing",
        message: "Processing your request..."
      }));

      const chatResponse = await this.sendToChatAgent(session.chatAgentId, transcript);

      console.log(`[Voice] Chat response: ${chatResponse}`);

      session.websocket.send(JSON.stringify({
        type: "response-text",
        text: chatResponse
      }));

      // Step 3: Text-to-Speech
      session.websocket.send(JSON.stringify({
        type: "processing",
        message: "Generating speech..."
      }));

      const audioResponse = await this.textToSpeech(chatResponse);

      // Step 4: Stream audio back
      session.websocket.send(JSON.stringify({
        type: "audio-response",
        audio: this.arrayBufferToBase64(audioResponse),
        format: "audio/wav"
      }));

      session.websocket.send(JSON.stringify({
        type: "complete",
        message: "Response complete"
      }));

      // Clear buffer
      session.audioBuffer = [];

    } catch (error) {
      console.error(`[Voice] Error processing audio:`, error);
      session.websocket.send(JSON.stringify({
        type: "error",
        error: `Failed to process audio: ${error}`
      }));
    }
  }

  /**
   * Convert speech to text using Cloudflare Workers AI (primary) or HuggingFace (fallback)
   */
  private async speechToText(audioData: Uint8Array): Promise<string> {
    // Try Workers AI first (@cf/openai/whisper-tiny-en)
    if (this.env.AI) {
      try {
        console.log("[Voice] Attempting STT with Workers AI (Whisper)");
        console.log("[Voice] Audio data size:", audioData.length, "bytes");

        // Workers AI Whisper expects audio as array of numbers (0-255)
        const response = await this.env.AI.run("@cf/openai/whisper-tiny-en", {
          audio: Array.from(audioData)
        }) as { text?: string };

        if (response && response.text) {
          console.log("[Voice] Workers AI STT success:", response.text);
          return response.text;
        }
      } catch (error) {
        console.error("[Voice] Workers AI STT error:", error);
        console.warn("[Voice] Falling back to HuggingFace");
      }
    }

    // Fallback to HuggingFace ResembleAI
    try {
      console.log("[Voice] Using HuggingFace ResembleAI for STT");

      const response = await fetch("https://api-inference.huggingface.co/models/ResembleAI/chatterbox-turbo-demo", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "audio/wav"
        },
        body: audioData
      });

      if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.status} - ${await response.text()}`);
      }

      const result = await response.json() as { text: string };
      return result.text || "";

    } catch (error) {
      console.error("[Voice] All STT providers failed:", error);
      throw new Error(`Speech-to-text failed: ${error}`);
    }
  }

  /**
   * Convert text to speech using Deepgram API
   */
  private async textToSpeech(text: string): Promise<ArrayBuffer> {
    try {
      console.log("[Voice] Using Deepgram TTS");
      console.log("[Voice] Text to synthesize:", text.substring(0, 100));

      if (!this.env.DEEPGRAM_API_KEY) {
        throw new Error("DEEPGRAM_API_KEY not configured");
      }

      // Use Deepgram TTS REST API
      const response = await fetch("https://api.deepgram.com/v1/speak?model=aura-asteria-en", {
        method: "POST",
        headers: {
          "Authorization": `Token ${this.env.DEEPGRAM_API_KEY}`,
          "Content-Type": "text/plain"
        },
        body: text
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Voice] Deepgram TTS error: ${response.status} - ${errorText}`);
        throw new Error(`Deepgram TTS API error: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      console.log("[Voice] Deepgram TTS success, audio size:", audioBuffer.byteLength, "bytes");
      return audioBuffer;

    } catch (error) {
      console.error("[Voice] Deepgram TTS failed:", error);
      throw new Error(`Text-to-speech failed: ${error}`);
    }
  }

  /**
   * Send transcript to Chat Agent for processing
   */
  private async sendToChatAgent(chatAgentId: string, message: string): Promise<string> {
    try {
      // Get Chat DO
      const id = this.env.Chat.idFromName(chatAgentId);
      const chatDO = this.env.Chat.get(id);

      // Send message to chat agent using new voice message endpoint
      const response = await chatDO.fetch(new Request("https://fake-host/voice/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: message
        })
      }));

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Voice] Chat agent error: ${response.status} - ${errorText}`);
        throw new Error(`Chat agent error: ${response.status}`);
      }

      const result = await response.json() as { text: string; success: boolean };

      return result.text || "I'm sorry, I couldn't process that request.";

    } catch (error) {
      console.error("[Voice] Chat agent error:", error);
      return "I'm experiencing technical difficulties. Please try again.";
    }
  }

  /**
   * Utility: Convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Utility: Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
