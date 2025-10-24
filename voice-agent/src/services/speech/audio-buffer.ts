/**
 * Audio Buffer Manager
 * Safely buffers incoming μ-law audio frames during recording
 */

export class AudioBuffer {
  private buffer: Buffer;
  private readonly MAX_SIZE: number;
  private readonly MIN_SIZE: number;

  constructor(maxSizeBytes = 80000, minSizeBytes = 800) {
    this.buffer = Buffer.alloc(0);
    this.MAX_SIZE = maxSizeBytes; // ~10 seconds at 8kHz
    this.MIN_SIZE = minSizeBytes; // ~100ms at 8kHz
  }

  /**
   * Reset buffer to empty
   */
  reset(): void {
    this.buffer = Buffer.alloc(0);
  }

  /**
   * Append audio chunk to buffer
   * @returns false if max size would be exceeded
   */
  append(chunk: Buffer): boolean {
    const newSize = this.buffer.length + chunk.length;
    
    if (newSize > this.MAX_SIZE) {
      return false; // Buffer full
    }
    
    this.buffer = Buffer.concat([this.buffer, chunk]);
    return true;
  }

  /**
   * Get the current buffer
   */
  getBuffer(): Buffer {
    return this.buffer;
  }

  /**
   * Get current buffer size in bytes
   */
  getSize(): number {
    return this.buffer.length;
  }

  /**
   * Check if buffer has minimum required data
   */
  hasMinimumData(): boolean {
    return this.buffer.length >= this.MIN_SIZE;
  }

  /**
   * Check if buffer is full
   */
  isFull(): boolean {
    return this.buffer.length >= this.MAX_SIZE;
  }

  /**
   * Get buffer duration in milliseconds (at 8kHz μ-law)
   */
  getDurationMs(): number {
    // 8000 bytes per second at 8kHz
    return (this.buffer.length / 8000) * 1000;
  }
}
