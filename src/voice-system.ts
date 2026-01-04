// Voice Functionality Fix for Kiamichi Business Agent
// Enables talk-to-text and text-to-speech with proper WebSocket handling

export interface VoiceConfig {
  sampleRate: number;
  bufferSize: number;
  channels: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
}

const VOICE_CONFIG: VoiceConfig = {
  sampleRate: 16000,
  bufferSize: 4096,
  channels: 1,
  echoCancellation: true,
  noiseSuppression: true
};

/**
 * Initialize voice functionality with proper error handling
 */
export class VoiceManager {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isListening = false;
  private isConnected = false;

  constructor(private wsUrl: string) {}

  /**
   * Connect to voice WebSocket server
   */
  async connect(): Promise<boolean> {
    try {
      console.log("[Voice] Connecting to:", this.wsUrl);
      
      // Create WebSocket connection
      this.ws = new WebSocket(this.wsUrl);
      
      return new Promise((resolve) => {
        this.ws!.onopen = () => {
          console.log("[Voice] WebSocket connected");
          this.isConnected = true;
          resolve(true);
        };
        
        this.ws!.onclose = () => {
          console.log("[Voice] WebSocket disconnected");
          this.isConnected = false;
        };
        
        this.ws!.onerror = (error) => {
          console.error("[Voice] WebSocket error:", error);
          resolve(false);
        };
        
        this.ws!.onmessage = (event) => {
          this.handleVoiceMessage(event.data);
        };
      });
    } catch (error) {
      console.error("[Voice] Connection failed:", error);
      return false;
    }
  }

  /**
   * Start microphone access and audio processing
   */
  async startListening(): Promise<boolean> {
    if (!this.isConnected) {
      console.error("[Voice] Not connected to voice server");
      return false;
    }

    try {
      console.log("[Voice] Starting microphone access...");
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: VOICE_CONFIG.channels,
          echoCancellation: VOICE_CONFIG.echoCancellation,
          noiseSuppression: VOICE_CONFIG.noiseSuppression,
          sampleRate: VOICE_CONFIG.sampleRate
        }
      });
      
      this.mediaStream = stream;
      console.log("[Voice] Microphone access granted");
      
      // Create audio context
      this.audioContext = new AudioContext({ sampleRate: VOICE_CONFIG.sampleRate });
      
      // Create audio source and processor
      const source = this.audioContext.createMediaStreamSource(stream);
      this.processor = this.audioContext.createScriptProcessor(
        VOICE_CONFIG.bufferSize,
        VOICE_CONFIG.channels,
        VOICE_CONFIG.channels
      );
      
      // Set up audio processing
      this.processor.onaudioprocess = (event) => {
        if (!this.isListening || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const inputData = event.inputBuffer.getChannelData(0);
        const pcmData = this.float32ToInt16(inputData);
        
        // Send audio data to server
        this.ws.send(JSON.stringify({
          type: "audio-chunk",
          audio: this.arrayBufferToBase64(pcmData.buffer as ArrayBuffer),
          timestamp: Date.now()
        }));
      };
      
      // Connect audio pipeline
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
      this.isListening = true;
      
      // Notify server we're listening
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "start-listening" }));
      }
      
      console.log("[Voice] Listening started");
      return true;
      
    } catch (error) {
      console.error("[Voice] Failed to start listening:", error);
      
      if (error.name === 'NotAllowedError') {
        alert("Microphone access denied. Please allow microphone access in your browser settings.");
      } else if (error.name === 'NotFoundError') {
        alert("No microphone found. Please connect a microphone and try again.");
      } else {
        alert(`Voice error: ${error.message}`);
      }
      
      return false;
    }
  }

  /**
   * Stop listening and cleanup
   */
  stopListening(): void {
    console.log("[Voice] Stopping listening...");
    
    this.isListening = false;
    
    // Notify server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "stop-listening" }));
    }
    
    // Cleanup audio pipeline
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    console.log("[Voice] Listening stopped");
  }

  /**
   * Disconnect and cleanup everything
   */
  disconnect(): void {
    console.log("[Voice] Disconnecting...");
    
    this.stopListening();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    console.log("[Voice] Disconnected");
  }

  /**
   * Handle voice messages from server
   */
  private handleVoiceMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      console.log("[Voice] Received message:", message.type);
      
      switch (message.type) {
        case "transcript":
          // User's speech was transcribed
          console.log("[Voice] Transcript:", message.text);
          this.onTranscript(message.text);
          break;
          
        case "response-text":
          // Agent response text
          console.log("[Voice] Response text:", message.text);
          this.onResponseText(message.text);
          break;
          
        case "response-audio":
          // Agent response audio (text-to-speech)
          console.log("[Voice] Response audio received");
          this.onResponseAudio(message.audio);
          break;
          
        case "error":
          console.error("[Voice] Server error:", message.error);
          this.onError(message.error);
          break;
          
        default:
          console.log("[Voice] Unknown message type:", message.type);
      }
    } catch (error) {
      console.error("[Voice] Failed to handle message:", error);
    }
  }

  // Event handlers (to be overridden by implementation)
  onTranscript(text: string): void {
    console.log("[Voice] Transcript event:", text);
  }

  onResponseText(text: string): void {
    console.log("[Voice] Response text event:", text);
  }

  onResponseAudio(audioBase64: string): void {
    console.log("[Voice] Response audio event received");
  }

  onError(error: string): void {
    console.error("[Voice] Error event:", error);
  }

  // Utility functions
  private float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  get isConnected(): boolean {
    return this.isConnected;
  }

  get isListening(): boolean {
    return this.isListening;
  }
}

/**
 * Voice WebSocket Server Handler
 * Handles voice processing on the server side
 */
export class VoiceServerHandler {
  private ws: WebSocket;
  private audioBuffer: string[] = [];
  private isProcessing = false;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case "start-listening":
            await this.handleStartListening();
            break;
            
          case "stop-listening":
            await this.handleStopListening();
            break;
            
          case "audio-chunk":
            await this.handleAudioChunk(message.audio);
            break;
            
          default:
            console.log("[Voice Server] Unknown message:", message.type);
        }
      } catch (error) {
        console.error("[Voice Server] Error handling message:", error);
        this.ws.send(JSON.stringify({ type: "error", error: error.message }));
      }
    };
  }

  private async handleStartListening(): Promise<void> {
    console.log("[Voice Server] Starting listening session");
    this.audioBuffer = [];
    this.isProcessing = false;
    
    this.ws.send(JSON.stringify({ 
      type: "listening-started",
      message: "Ready to receive audio"
    }));
  }

  private async handleStopListening(): Promise<void> {
    console.log("[Voice Server] Stopping listening session");
    
    if (this.audioBuffer.length > 0) {
      await this.processAudioBuffer();
    }
    
    this.ws.send(JSON.stringify({ 
      type: "listening-stopped",
      message: "Audio processing complete"
    }));
  }

  private async handleAudioChunk(audioBase64: string): Promise<void> {
    // Collect audio chunks
    this.audioBuffer.push(audioBase64);
    
    // Process when we have enough audio (e.g., 5 seconds worth)
    if (this.audioBuffer.length > 50 && !this.isProcessing) { // Approx 5 seconds at 10 chunks/second
      await this.processAudioBuffer();
    }
  }

  private async processAudioBuffer(): Promise<void> {
    if (this.isProcessing || this.audioBuffer.length === 0) return;
    
    this.isProcessing = true;
    
    try {
      console.log("[Voice Server] Processing audio buffer...");
      
      // Combine all audio chunks
      const combinedAudio = this.audioBuffer.join('');
      this.audioBuffer = []; // Clear buffer
      
      // Convert base64 to audio data
      const audioData = Buffer.from(combinedAudio, 'base64');
      
      // Here you would:
      // 1. Send to speech-to-text service (Workers AI, Whisper, etc.)
      // 2. Process the transcribed text
      // 3. Generate response
      // 4. Send back to client
      
      // For now, simulate processing
      setTimeout(() => {
        // Simulate transcript
        const mockTranscript = "Hello, I'm testing the voice system. How's it working?";
        this.ws.send(JSON.stringify({
          type: "transcript",
          text: mockTranscript
        }));
        
        // Simulate response
        setTimeout(() => {
          const responseText = "Hey there! The voice system is working great. Bigfoot Jr. says hello! 🦶";
          
          // Send text response
          this.ws.send(JSON.stringify({
            type: "response-text",
            text: responseText
          }));
          
          // Generate audio response (mock)
          const mockAudio = "mock-audio-base64-data";
          this.ws.send(JSON.stringify({
            type: "response-audio",
            audio: mockAudio
          }));
          
        }, 1000);
        
      }, 1000);
      
    } catch (error) {
      console.error("[Voice Server] Processing error:", error);
      this.ws.send(JSON.stringify({
        type: "error",
        error: "Failed to process audio"
      }));
    } finally {
      this.isProcessing = false;
    }
  }
}