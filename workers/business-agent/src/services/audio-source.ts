/**
 * Audio Source - Microphone Input
 * Captures audio from user's microphone and sends to voice agent
 * Based on: https://github.com/AshishKumar4/cloudflare-voicebots
 */

export interface AudioSourceConfig {
  sampleRate?: number;
  channels?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export class AudioSource {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isRecording = false;
  private onAudioData: ((data: ArrayBuffer) => void) | null = null;

  constructor(private config: AudioSourceConfig = {}) {
    this.config = {
      sampleRate: 16000,
      channels: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...config
    };
  }

  /**
   * Initialize microphone access
   */
  async initialize(): Promise<void> {
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl
        },
        video: false
      });

      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate
      });

      console.log("[AudioSource] Initialized with sample rate:", this.audioContext.sampleRate);

    } catch (error) {
      console.error("[AudioSource] Failed to initialize:", error);
      throw new Error(`Microphone access denied: ${error}`);
    }
  }

  /**
   * Start recording audio
   */
  startRecording(onAudioData: (data: ArrayBuffer) => void): void {
    if (!this.mediaStream || !this.audioContext) {
      throw new Error("Audio source not initialized. Call initialize() first.");
    }

    if (this.isRecording) {
      console.warn("[AudioSource] Already recording");
      return;
    }

    this.onAudioData = onAudioData;
    this.isRecording = true;

    // Create source from media stream
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Create processor node (buffer size: 4096 samples)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    // Handle audio process event
    this.processor.onaudioprocess = (event) => {
      if (!this.isRecording) return;

      const inputData = event.inputBuffer.getChannelData(0);

      // Convert Float32Array to Int16Array (PCM)
      const pcmData = this.float32ToInt16(inputData);

      // Send to callback
      if (this.onAudioData) {
        // Ensure we pass an ArrayBuffer (not SharedArrayBuffer)
        this.onAudioData(pcmData.buffer as ArrayBuffer);
      }
    };

    // Connect nodes
    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    console.log("[AudioSource] Recording started");
  }

  /**
   * Stop recording audio
   */
  stopRecording(): void {
    if (!this.isRecording) {
      console.warn("[AudioSource] Not currently recording");
      return;
    }

    this.isRecording = false;

    // Disconnect processor
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    console.log("[AudioSource] Recording stopped");
  }

  /**
   * Release resources
   */
  async dispose(): Promise<void> {
    this.stopRecording();

    // Stop all tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== "closed") {
      await this.audioContext.close();
      this.audioContext = null;
    }

    console.log("[AudioSource] Disposed");
  }

  /**
   * Check if microphone is available
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(device => device.kind === "audioinput");
    } catch {
      return false;
    }
  }

  /**
   * Convert Float32Array to Int16Array (PCM 16-bit)
   */
  private float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);

    for (let i = 0; i < float32Array.length; i++) {
      // Clamp and convert to 16-bit PCM
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    return int16Array;
  }

  /**
   * Get current recording state
   */
  get recording(): boolean {
    return this.isRecording;
  }
}
