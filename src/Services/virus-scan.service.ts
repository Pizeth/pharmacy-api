// src/services/virus-scan.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { FormData } from 'formdata-node'; // Use formdata-node for Node.js
import { Blob } from 'buffer'; // Node.js 18+ has Blob

@Injectable()
export class VirusScanService {
  private readonly logger = new Logger(VirusScanService.name);
  private readonly apiKey = process.env.VIRUSTOTAL_API_KEY;
  private readonly apiUrl = 'https://www.virustotal.com/api/v3';

  constructor(private readonly httpService: HttpService) {}

  async scanBuffer(buffer: Buffer): Promise<boolean> {
    try {
      // 1. Calculate file hash using native crypto
      const fileHash = this.calculateSha256(buffer);

      // 2. Check existing report
      const report = await this.getFileReport(fileHash);

      if (report) {
        return this.isFileClean(report);
      }

      // 3. Upload for analysis if not found
      const analysisId = await this.uploadFile(buffer);
      return await this.waitForAnalysis(analysisId);
    } catch (error) {
      this.logger.error(`VirusTotal scan failed: ${error.message}`);
      throw error;
    }
  }

  private calculateSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private async getFileReport(fileHash: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/files/${fileHash}`, {
          headers: { 'x-apikey': this.apiKey },
        }),
      );
      return response.data.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // File not found in VT database
      }
      throw new Error(
        `Report check failed: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  private async uploadFile(buffer: Buffer): Promise<string> {
    try {
      // Create FormData with native modules
      const form = new FormData();
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      form.append('file', blob, 'file-to-scan');

      // Get headers from FormData
      const formHeaders = form.getHeaders();

      const response = await firstValueFrom(
        this.httpService.post(`${this.apiUrl}/files`, form, {
          headers: {
            'x-apikey': this.apiKey,
            ...formHeaders,
          },
        }),
      );

      return response.data.data.id;
    } catch (error) {
      throw new Error(
        `Upload failed: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  private async waitForAnalysis(
    analysisId: string,
    timeout = 30000,
  ): Promise<boolean> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < timeout) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`${this.apiUrl}/analyses/${analysisId}`, {
            headers: { 'x-apikey': this.apiKey },
          }),
        );

        const status = response.data.data.attributes.status;

        if (status === 'completed') {
          return this.isFileClean(response.data.data);
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error) {
        throw new Error(`Analysis check failed: ${error.message}`);
      }
    }

    throw new Error('Analysis timed out');
  }

  private isFileClean(report: any): boolean {
    const stats = report.attributes?.last_analysis_stats;

    if (!stats) {
      throw new Error('Invalid report format from VirusTotal');
    }

    // Consider file clean if no engines detected malware
    return stats.malicious === 0 && stats.suspicious === 0;
  }

  // Add rate limiting
  private lastRequestTime = 0;
  private readonly rateLimit = 15000; // 15s between requests (4/min)

  private async checkRateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.rateLimit) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.rateLimit - elapsed),
      );
    }

    this.lastRequestTime = Date.now();
  }
}
