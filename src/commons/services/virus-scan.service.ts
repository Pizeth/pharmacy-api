import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import FormData from 'form-data';
import {
  VirusTotalReport,
  VirusTotalUrlAnalysisResponse,
} from 'src/types/virus_total';
import statusCode from 'http-status-codes';
import { TotalVirusResponseHandlerService } from './totalvirus_response_handler.service';

@Injectable()
export class VirusScanService {
  private readonly logger = new Logger(VirusScanService.name);
  private readonly apiKey = process.env.VIRUSTOTAL_API_KEY;
  private readonly apiUrl = process.env.VIRUSTOTAL_API_URL;
  private lastRequestTime = 0;
  // Add rate limiting
  private readonly rateLimit =
    Number(process.env.VIRUSTOTAL_API_RATE_LIMIT) || 1500; // 15s between requests (4/min)
  private hashCache = new Map<string, boolean>();

  constructor(
    private readonly httpService: HttpService,
    private readonly responseHandler: TotalVirusResponseHandlerService,
  ) {}

  async scanBuffer(buffer: Buffer): Promise<boolean> {
    try {
      // 1. Calculate file hash using native crypto
      const fileHash = this.calculateSha256(buffer);
      if (this.hashCache.has(fileHash)) {
        return this.hashCache.get(fileHash) ?? false;
      }

      // 2. Check existing report
      const report = await this.getFileReport(fileHash);

      if (report) {
        this.logger.debug(`Found existing report for hash: ${fileHash}`);
        const isClean = this.isFileClean(report);
        this.hashCache.set(fileHash, isClean);
        return isClean;
      }

      // 3. If no report, upload the file for analysis
      this.logger.debug(`No existing report. Uploading file for analysis...`);
      const analysisId = await this.uploadFile(buffer);
      const result = await this.waitForAnalysis(analysisId);
      this.hashCache.set(fileHash, result);
      return result;
    } catch (error: unknown) {
      // this.handleVirusTotalError(error);
      // Any other error from the sub-methods will be caught here and re-thrown
      // as a standard application error.
      this.logger.error(
        'An unrecoverable error occurred during virus scan.',
        error,
      );
      throw new BadRequestException(
        'Could not complete file scan due to an external service error.',
      );
    }
  }

  private async getFileReport(
    fileHash: string,
  ): Promise<VirusTotalReport | null> {
    try {
      await this.checkRateLimit();
      const response = await firstValueFrom(
        this.httpService.get<VirusTotalReport>(
          `${this.apiUrl}/files/${fileHash}`,
          { headers: { 'x-apikey': this.apiKey } },
        ),
      );
      return response.data;
    } catch (error: unknown) {
      // Specifically check for a 404 Not Found error.
      // This is an expected outcome, not a system failure.
      if (
        this.responseHandler.isAxiosError(error) &&
        error.response?.status === statusCode.NOT_FOUND
      ) {
        this.logger.warn(
          `File hash ${fileHash} not found on VirusTotal. This is expected for new files.`,
        );
        return null; // Return null to signal that no report was found.
      }

      // For all other errors (401, 429, 500, etc.), we treat them as
      // unrecoverable failures and throw them to be handled by the main try-catch block.
      this.responseHandler.handleVirusTotalError(error);

      // const errMsg = this.getErrorMessage(error);
      // if (
      //   error instanceof AxiosError &&
      //   error?.response?.status === statusCode.NOT_FOUND
      // ) {
      //   this.logger.warn(`File not found in VirusTotal: ${fileHash}`);
      //   return null; // File not found in VT database
      // }
      // throw new Error(`Report check failed: ${errMsg}`);
    }
  }

  private async uploadFile(buffer: Buffer): Promise<string> {
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

      const response = await firstValueFrom(
        this.httpService.post<VirusTotalReport>(`${this.apiUrl}/files`, form, {
          headers,
          // Axios will handle content-length automatically
        }),
      );

      // The actual API payload from VirusTotal is in response.data
      const result: VirusTotalReport = response.data;

      // if (this.isUrlAnalysisResponse(result)) {
      //   // Successfully uploaded, response is an Analysis object
      //   this.logger.log(
      //     `File uploaded successfully. Analysis ID: ${result.data.id}`,
      //   );
      //   return result.data.id;
      // } else

      if (this.responseHandler.isFileUploadResponse(result)) {
        // Successfully uploaded, response is a FileUploadResponse object
        this.logger.log(
          `File uploaded successfully. Analysis ID: ${result.data.id}`,
        );
        return result.data.id; // This is the analysis ID
      } else if (this.responseHandler.isApiErrorResponse(result)) {
        this.logger.warn(
          `VirusTotal API error (in 2xx response) during upload: ${result.error.code} - ${result.error.message}`,
        );
        throw new Error(
          `VirusTotal API Error (${result.error.code}): ${result.error.message}`,
        );
      } else {
        this.logger.error(
          'Unknown 2xx response structure after file upload:',
          result,
        );
        this.logger.debug(result);
        // If we reach here, the response is not in the expected format.
        throw new Error(
          'Unknown successful response structure after file upload.',
        );
      }

      if (this.responseHandler.isUrlAnalysisResponse(result)) {
        // Successfully uploaded, response is an Analysis object
        return result.data.id; // This is the analysis ID
      } else if (this.responseHandler.isApiErrorResponse(result)) {
        // HTTP 2xx, but VirusTotal API returned an error in the response body
        this.logger.warn(
          `VirusTotal API error (in 2xx response) during upload: ${result.error.code} - ${result.error.message}`,
        );
        return result.error.code; // Return the error code string
      } else {
        // HTTP 2xx, but response body isn't a known VT success or error structure.
        this.logger.error(
          'Unknown 2xx response structure after file upload:',
          result,
        );
        throw new Error(
          'Unknown successful response structure after file upload.',
        );
      }
    } catch (error) {
      this.responseHandler.handleVirusTotalError(error);
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

        const status = this.responseHandler.isUrlAnalysisResponse(response)
          ? response.data.attributes.status
          : null;

        if (status === 'completed') {
          return this.isFileClean(response);
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error) {
        this.responseHandler.handleVirusTotalError(error);
      }
    }

    throw new Error('Analysis timed out');
  }

  private isFileClean(report: VirusTotalReport): boolean {
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
    const stats = !this.responseHandler.isApiErrorResponse(report)
      ? this.responseHandler.isFileReportResponse(report)
        ? report.data.attributes.last_analysis_stats
        : this.responseHandler.isUrlAnalysisResponse(report)
          ? report.data.attributes.stats
          : null
      : null;

    if (!stats) {
      throw new Error(
        'Invalid report format from VirusTotal: Analysis Stats is missing',
      );
    }

    // Consider file clean if no engines detected malware
    return stats.malicious === 0 && stats.suspicious === 0;
  }

  private calculateSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
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

// const errMsg = this.getErrorMessage(error);
// if (
//   error instanceof AxiosError &&
//   error?.response?.status === statusCode.INTERNAL_SERVER_ERROR
// ) {
//   this.logger.warn(`Failed to upload file to VirusTotal`);
//   // return null; // File not found in VT database
// }
// // throw new Error(`Report check failed: ${errMsg}`);
// throw new Error(`Upload failed: ${errMsg}`);

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

// /**
//  * Type guard to check if the report is a successful VirusTotalResponse.
//  */
// private isFileSuccess(
//   report: VirusTotalReport,
// ): report is VirusTotalResponse {
//   return (
//     'data' in report && report.data !== undefined && !('error' in report)
//   );
// }

// /**
//  * Type guard to check if the report is an VirusTotalUrlAnalysisReport.
//  */
// private isUrlAnalysis(
//   report: VirusTotalReport,
// ): report is VirusTotalUrlAnalysisResponse {
//   return (
//     this.isFileSuccess(report) &&
//     'attributes' in report &&
//     report.data.attributes !== undefined &&
//     'status' in report.data.attributes
//   );
// }

// /**
//  * Type guard to check if the report is an VirusTotalApiErrorResponse.
//  */
// private isFileError(
//   report: VirusTotalReport,
// ): report is VirusTotalApiErrorResponse {
//   return 'error' in report && report.error !== undefined;
// }
