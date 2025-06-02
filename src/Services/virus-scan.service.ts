// src/services/virus-scan.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import FormData from 'form-data';
// import { Blob } from 'buffer'; // Node.js 18+ has Blob
import {
  VirusTotalApiErrorResponse,
  VirusTotalFileReport,
  VirusTotalResponse,
  VirusTotalUrlAnalysisResponse,
} from 'src/Types/Types';
import { AxiosError } from 'axios';
import { StatusCodes } from 'http-status-codes';
import e from 'express';

@Injectable()
export class VirusScanService {
  private readonly logger = new Logger(VirusScanService.name);
  private readonly apiKey = process.env.VIRUSTOTAL_API_KEY;
  private readonly apiUrl = process.env.VIRUSTOTAL_API_URL;
  // Add rate limiting
  private lastRequestTime = 0;
  private readonly rateLimit =
    Number(process.env.VIRUSTOTAL_API_RATE_LIMIT) || 1500; // 15s between requests (4/min)

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
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`VirusTotal scan failed: ${errorMessage}`);
      throw error;
    }
  }

  private calculateSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private async getFileReport(
    fileHash: string,
  ): Promise<VirusTotalFileReport | null> {
    try {
      await this.checkRateLimit();
      // const response = await firstValueFrom<VirusTotalFileReport>(
      //   this.httpService.get(`${this.apiUrl}/files/${fileHash}`, {
      //     headers: { 'x-apikey': this.apiKey },
      //   }),
      // );
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/files/${fileHash}`, {
          headers: { 'x-apikey': this.apiKey },
        }),
      );
      return response;
    } catch (error: unknown) {
      // Handle specific error cases
      const errMsg = this.getErrorMessage(error);
      // const errMsg =
      //   error instanceof AxiosError
      //     ? error.message
      //     : error instanceof Error
      //       ? error.message
      //       : new Error('Unknown error');
      if (
        error instanceof AxiosError &&
        error?.response?.status === StatusCodes.NOT_FOUND
      ) {
        this.logger.warn(`File not found in VirusTotal: ${fileHash}`);
        return null; // File not found in VT database
      }
      throw new Error(`Report check failed: ${errMsg}`);
    }
  }

  private async uploadFile(buffer: Buffer): Promise<string | null> {
    try {
      // Create FormData with native modules
      const form = new FormData();

      // Append file with proper metadata
      form.append('file', buffer, {
        filename: 'file-to-scan',
        contentType: 'application/octet-stream',
        knownLength: buffer.length,
      });

      // Get headers from FormData
      const headers = {
        ...form.getHeaders(),
        'x-apikey': this.apiKey,
        Accept: 'application/json',
      };

      const response = await firstValueFrom<VirusTotalFileReport>(
        this.httpService.post(`${this.apiUrl}/files`, form, {
          headers,
          // Axios will handle content-length automatically
        }),
      );

      return this.isFileSuccess(response)
        ? response.data.id
        : this.isFileError(response)
          ? response.error.code
          : null;
    } catch (error) {
      const errMsg = this.getErrorMessage(error);
      if (
        error instanceof AxiosError &&
        error?.response?.status === StatusCodes.INTERNAL_SERVER_ERROR
      ) {
        this.logger.warn(`Failed to upload file to VirusTotal`);
        return null; // File not found in VT database
      }
      // throw new Error(`Report check failed: ${errMsg}`);
      throw new Error(`Upload failed: ${errMsg}`);
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
        const response = await firstValueFrom<VirusTotalUrlAnalysisResponse>(
          this.httpService.get(`${this.apiUrl}/analyses/${analysisId}`, {
            headers: { 'x-apikey': this.apiKey },
          }),
        );

        const status = this.isUrlAnalysis(response)
          ? response.data.attributes.status
          : null;

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

  private isFileClean(report: VirusTotalFileReport): boolean {
    // Type guard to check if the report is an error response
    // if ('error' in report) {
    //   console.error(
    //     `VirusTotal API Error: ${report.error.code} - ${report.error.message}`,
    //   );
    //   // Throwing an error if this function expects a successful report.
    //   throw new Error(
    //     `VirusTotal API Error: ${report.error.code} - ${report.error.message}`,
    //   );
    // }

    // Type guard to check if the report is an error response
    const stats = this.isFileSuccess(report)
      ? report.data.attributes.last_analysis_stats
      : null;

    if (!stats) {
      throw new Error(
        'Invalid report format from VirusTotal: last_analysis_stats missing',
      );
    }

    // Consider file clean if no engines detected malware
    return stats.malicious === 0 && stats.suspicious === 0;
  }

  // private isFileSuccess(report: VirusTotalFileReport): boolean {
  //   // Type guard to check if the report is an error response
  //   if ('error' in report) {
  //     console.error(
  //       `VirusTotal API Error: ${report.error.code} - ${report.error.message}`,
  //     );
  //     // Throwing an error if this function expects a successful report.
  //     throw new Error(
  //       `VirusTotal API Error: ${report.error.code} - ${report.error.message}`,
  //     );
  //   }
  //   return true; // If no error, we consider the file successfully scanned
  // }

  /**
   * Type guard to check if the report is a successful VirusTotalResponse.
   */
  private isFileSuccess(
    report: VirusTotalFileReport,
  ): report is VirusTotalResponse {
    return (
      'data' in report && report.data !== undefined && !('error' in report)
    );
  }

  /**
   * Type guard to check if the report is an VirusTotalUrlAnalysisReport.
   */
  private isUrlAnalysis(
    report: VirusTotalUrlAnalysisResponse,
  ): report is VirusTotalUrlAnalysisResponse {
    return (
      this.isFileSuccess(report) &&
      'attributes' in report &&
      report.data.attributes !== undefined &&
      'status' in report.data.attributes
    );
  }

  /**
   * Type guard to check if the report is an VirusTotalApiErrorResponse.
   */
  private isFileError(
    report: VirusTotalFileReport,
  ): report is VirusTotalApiErrorResponse {
    return 'error' in report && report.error !== undefined;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof AxiosError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Unknown error';
  }

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
