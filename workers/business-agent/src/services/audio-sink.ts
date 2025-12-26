/**
 * Audio Sink - Speaker Output
 * Plays audio responses from voice agent
 * Based on: https://github.com/AshishKumar4/cloudflare-voicebots
 */

export class AudioSink {
  private audioContext: AudioContext | null = null;
  private audioQueue: ArrayBuffer[] = [];
  private isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;

  constructor() {}

  /**
   * Initialize audio context
   */
  async initialize(): Promise<void> {
    try {
      this.audioContext = new AudioContext({
        sampleRate: 24000 // Cloudflare Workers AI TTS uses 24kHz
      });

      console.log("[AudioSink] Initialized with sample rate:", this.audioContext.sampleRate);

    } catch (error) {
      console.error("[AudioSink] Failed to initialize:", error);
      throw new Error(`Audio playback initialization failed: ${error}`);
    }
  }

  /**
   * Play audio data
   */
  async playAudio(audioData: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      throw new Error("Audio sink not initialized. Call initialize() first.");
    }

    try {
      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(audioData.slice(0));

      // Create source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      // Store current source for potential stopping
      this.currentSource = source;

      // Play audio
      source.start(0);

      console.log(`[AudioSink] Playing ${audioBuffer.duration.toFixed(2)}s of audio`);

      // Wait for audio to finish
      await new Promise<void>((resolve) => {
        source.onended = () => {
          this.currentSource = null;
          resolve();
        };
      });

    } catch (error) {
      console.error("[AudioSink] Failed to play audio:", error);
      throw new Error(`Audio playback failed: ${error}`);
    }
  }

  /**
   * Queue audio for playback
   */
  queueAudio(audioData: ArrayBuffer): void {
    this.audioQueue.push(audioData);

    // Start playing if not already playing
    if (!this.isPlaying) {
      this.playQueue();
    }
  }

  /**
   * Play queued audio
   */
  private async playQueue(): Promise<void> {
    if (this.isPlaying || this.audioQueue.length === 0) {
      return;
    }

    this.isPlaying = true;

    while (this.audioQueue.length > 0) {
      const audioData = this.audioQueue.shift();
      if (audioData) {
        try {
          await this.playAudio(audioData);
        } catch (error) {
          console.error("[AudioSink] Error playing queued audio:", error);
        }
      }
    }

    this.isPlaying = false;
  }

  /**
   * Stop current playback
   */
  stop(): void {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }

    // Clear queue
    this.audioQueue = [];
    this.isPlaying = false;

    console.log("[AudioSink] Playback stopped");
  }

  /**
   * Release resources
   */
  async dispose(): Promise<void> {
    this.stop();

    // Close audio context
    if (this.audioContext && this.audioContext.state !== "closed") {
      await this.audioContext.close();
      this.audioContext = null;
    }

    console.log("[AudioSink] Disposed");
  }

  /**
   * Resume audio context (required after user interaction)
   */
  async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === "suspended") {
      await this.audioContext.resume();
      console.log("[AudioSink] Audio context resumed");
    }
  }

  /**
   * Get current playback state
   */
  get playing(): boolean {
    return this.isPlaying;
  }
}
