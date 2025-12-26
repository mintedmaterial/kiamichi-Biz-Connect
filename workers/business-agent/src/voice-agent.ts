/**
 * Voice Agent Durable Object
 * Handles real-time voice interactions with dual STT/TTS providers:
 * Primary: Cloudflare Workers AI (@cf/openai/whisper-tiny-en + @cf/cloudflare/aura-2-es)
 * Fallback: HuggingFace ResembleAI/chatterbox-turbo-demo
 * Based on: https://github.com/AshishKumar4/cloudflare-voicebots
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
    const url = new URL(request.url);

    // WebSocket upgrade for voice streaming
    if (url.pathname === "/voice/stream" && request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocketUpgrade(request);
    }

    // Health check
    if (url.pathname === "/voice/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404 });
  }

  /**
   * Upgrade HTTP request to WebSocket for voice streaming
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the WebSocket connection
    server.accept();

    // Generate session ID
    const sessionId = crypto.randomUUID();

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
      await this.handleWebSocketMessage(sessionId, event);
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

    return new Response(null, {
      status: 101,
      webSocket: client
    });
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
          // Forward audio data directly to STT WebSocket for real-time transcription
          if (session.isListening) {
            const sttWs = this.sttWebSockets.get(sessionId);
            if (sttWs && sttWs.readyState === WebSocket.READY_OPEN) {
              const audioData = data.audio instanceof ArrayBuffer
                ? data.audio
                : this.base64ToArrayBuffer(data.audio);

              // Send raw PCM audio to Deepgram Flux
              sttWs.send(audioData);

              if (!session.hasReceivedAudio) {
                session.hasReceivedAudio = true;
                console.log("[Voice] First audio chunk sent to STT, size:", audioData.byteLength, "bytes");
              }
            } else {
              console.warn("[Voice] STT WebSocket not ready, state:", sttWs?.readyState);
            }
          }
          break;

        case "stop-listening":
          session.isListening = false;
          console.log(`[Voice] Session ${sessionId} stopped listening`);

          // Close STT WebSocket
          const sttWs = this.sttWebSockets.get(sessionId);
          if (sttWs) {
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
   * Initialize real-time STT using Workers AI Deepgram Flux
   */
  private async initializeRealtimeSTT(sessionId: string, session: VoiceSession): Promise<void> {
    try {
      console.log(`[Voice] Initializing real-time STT with Workers AI Deepgram Flux for session ${sessionId}`);

      // Use Workers AI Deepgram Flux model with WebSocket streaming
      // This is the native way to do real-time STT in Cloudflare Workers
      const response = await this.env.AI.run("@cf/deepgram/flux", {
        encoding: "linear16",
        sample_rate: "48000"
      }, {
        websocket: true
      }) as Response;

      // @ts-ignore - webSocket property exists on AI.run response in websocket mode
      const sttWs: WebSocket = response.webSocket;

      if (!sttWs) {
        throw new Error("Failed to create Deepgram Flux WebSocket");
      }

      console.log("[Voice] Workers AI Deepgram Flux WebSocket created, accepting...");
      sttWs.accept();
      this.sttWebSockets.set(sessionId, sttWs);

      let fullTranscript = "";

      // Handle transcription events from Workers AI Deepgram Flux
      sttWs.addEventListener("message", async (event: MessageEvent) => {
        try {
          const result = JSON.parse(event.data as string);
          console.log("[Voice] Workers AI Deepgram Flux event:", result);

          // Workers AI Deepgram Flux response format
          // { event: "Finalized", transcript: "text", turn_index: 0, ... }
          if (result.event === "Finalized" && result.transcript) {
            const transcript = result.transcript.trim();
            if (transcript) {
              fullTranscript += (fullTranscript ? " " : "") + transcript;
              console.log("[Voice] Full transcript so far:", fullTranscript);

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
              format: "audio/wav"
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
        console.error(`[Voice] STT WebSocket error for session ${sessionId}:`, error);
        session.websocket.send(JSON.stringify({
          type: "error",
          error: "Speech recognition error"
        }));
      });

      sttWs.addEventListener("close", () => {
        console.log(`[Voice] STT WebSocket closed for session ${sessionId}`);
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
   * Convert text to speech using Workers AI or fallback
   */
  private async textToSpeech(text: string): Promise<ArrayBuffer> {
    // Try Workers AI TTS first
    if (this.env.AI) {
      try {
        console.log("[Voice] Using Workers AI TTS");
        console.log("[Voice] Text to synthesize:", text.substring(0, 100));

        const response = await this.env.AI.run("@cf/cloudflare/aura-2-es", {
          text: text
        }) as ArrayBuffer;

        if (response && response.byteLength > 0) {
          console.log("[Voice] Workers AI TTS success, audio size:", response.byteLength, "bytes");
          return response;
        }
      } catch (error) {
        console.error("[Voice] Workers AI TTS error:", error);
        console.warn("[Voice] Falling back to HuggingFace");
      }
    }

    // Fallback to HuggingFace ResembleAI
    try {
      console.log("[Voice] Using HuggingFace ResembleAI for TTS");

      const response = await fetch("https://api-inference.huggingface.co/models/ResembleAI/chatterbox-turbo-demo", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: text })
      });

      if (!response.ok) {
        throw new Error(`HuggingFace TTS API error: ${response.status}`);
      }

      return await response.arrayBuffer();

    } catch (error) {
      console.error("[Voice] All TTS providers failed:", error);
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

      // Send message to chat agent
      const response = await chatDO.fetch(new Request("https://fake-host/agents/chat/default/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": "admin_session=voice-agent" // Bypass auth for internal calls
        },
        body: JSON.stringify({
          role: "user",
          parts: [{ type: "text", text: message }]
        })
      }));

      if (!response.ok) {
        throw new Error(`Chat agent error: ${response.status}`);
      }

      const result = await response.json() as any;

      // Extract text from response
      // Assuming response format matches agent message structure
      const textParts = result.parts?.filter((p: any) => p.type === "text") || [];
      const responseText = textParts.map((p: any) => p.text).join(" ");

      return responseText || "I'm sorry, I couldn't process that request.";

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
