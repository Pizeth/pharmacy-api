import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import FormData from 'form-data';
import {
  VirusTotalApiErrorResponse,
  VirusTotalReport,
  VirusTotalResponse,
  VirusTotalUrlAnalysisResponse,
} from 'src/types/types';
import { AxiosError } from 'axios';
import statusCode from 'http-status-codes';

@Injectable()
export class VirusScanService {
  private readonly logger = new Logger(VirusScanService.name);
  private readonly apiKey = process.env.VIRUSTOTAL_API_KEY;
  private readonly apiUrl = process.env.VIRUSTOTAL_API_URL;
  // Add rate limiting
  private lastRequestTime = 0;
  private readonly rateLimit =
    Number(process.env.VIRUSTOTAL_API_RATE_LIMIT) || 1500; // 15s between requests (4/min)
  private hashCache = new Map<string, boolean>();

  constructor(private readonly httpService: HttpService) {}

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
        return this.isFileClean(report);
      }

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

  private calculateSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
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
      // **THE FIX**: Specifically check for a 404 Not Found error.
      // This is an expected outcome, not a system failure.
      if (
        this.isAxiosError(error) &&
        error.response?.status === statusCode.NOT_FOUND
      ) {
        this.logger.warn(
          `File hash ${fileHash} not found on VirusTotal. This is expected for new files.`,
        );
        return null; // Return null to signal that no report was found.
      }

      // For all other errors (401, 429, 500, etc.), we treat them as
      // unrecoverable failures and throw them to be handled by the main try-catch block.
      this.handleVirusTotalError(error);

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

      if (this.isUrlAnalysisResponse(result)) {
        // Successfully uploaded, response is an Analysis object
        this.logger.log(
          `File uploaded successfully. Analysis ID: ${result.data.id}`,
        );
        return result.data.id;
      } else if (this.isApiErrorResponse(result)) {
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

      // return this.isApiErrorResponse(apiResponseBody)
      //   ? apiResponseBody.error.code
      //   : this.isUrlAnalysisResponse(apiResponseBody)
      //     ? apiResponseBody.data.id
      //     : this.isFileReportResponse(apiResponseBody)
      //       ? apiResponseBody.data.id
      //       : statusCode.getStatusText(statusCode.NOT_FOUND);

      // if (this.isUrlAnalysisResponse(apiResponseBody)) {
      //   // Successfully uploaded, response is an Analysis object
      //   return apiResponseBody.data.id; // This is the analysis ID
      // } else if (this.isApiErrorResponse(apiResponseBody)) {
      //   // HTTP 2xx, but VirusTotal API returned an error in the response body
      //   this.logger.warn(
      //     `VirusTotal API error (in 2xx response) during upload: ${apiResponseBody.error.code} - ${apiResponseBody.error.message}`,
      //   );
      //   return apiResponseBody.error.code; // Return the error code string
      // } else {
      //   // HTTP 2xx, but response body isn't a known VT success or error structure.
      //   this.logger.error(
      //     'Unknown 2xx response structure after file upload:',
      //     apiResponseBody,
      //   );
      //   return null;
      // }
    } catch (error) {
      this.handleVirusTotalError(error);
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

        const status = this.isUrlAnalysisResponse(response)
          ? response.data.attributes.status
          : null;

        if (status === 'completed') {
          return this.isFileClean(response);
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error) {
        this.handleVirusTotalError(error);
        // const errMsg = this.getErrorMessage(error);
        // throw new Error(`Analysis check failed: ${errMsg}`);
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
    const stats = !this.isApiErrorResponse(report)
      ? this.isFileReportResponse(report)
        ? report.data.attributes.last_analysis_stats
        : this.isUrlAnalysisResponse(report)
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

  // Type Guard for API Error Response
  public isApiErrorResponse(
    report: unknown,
  ): report is VirusTotalApiErrorResponse {
    // return (report as VirusTotalApiErrorResponse).error !== undefined;
    // A more robust check:
    // this.logger.debug('virus total response', report);
    return (
      typeof (report as VirusTotalApiErrorResponse).error === 'object' &&
      (report as VirusTotalApiErrorResponse).error !== null &&
      typeof (report as VirusTotalApiErrorResponse).error.code === 'string'
    );
  }

  // Type Guard for successful File Report (VirusTotalResponse)
  public isFileReportResponse(report: unknown): report is VirusTotalResponse {
    if (this.isApiErrorResponse(report)) return false; // Exclude errors first
    const potentialFileReport = report as VirusTotalResponse;
    return (
      potentialFileReport.data !== undefined &&
      potentialFileReport.data.type === 'file' && // Key differentiator
      potentialFileReport.data.attributes !== undefined &&
      potentialFileReport.data.attributes.last_analysis_stats !== undefined
    ); // Specific to file attributes
  }

  // Type Guard for successful URL Analysis Response (VirusTotalUrlAnalysisResponse)
  public isUrlAnalysisResponse(
    report: unknown,
  ): report is VirusTotalUrlAnalysisResponse {
    if (this.isApiErrorResponse(report)) return false; // Exclude errors first
    const potentialUrlReport = report as VirusTotalUrlAnalysisResponse;
    return (
      potentialUrlReport.data !== undefined &&
      potentialUrlReport.data.type === 'analysis' && // Key differentiator
      potentialUrlReport.data.attributes !== undefined &&
      typeof potentialUrlReport.data.attributes.status === 'string'
    ); // Specific to URL analysis attributes
  }

  // private getErrorMessage1(error: unknown): string {
  //   return error instanceof AxiosError
  //     ? error.message
  //     : error instanceof Error
  //       ? error.message
  //       : 'Unknown error';
  // }

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

  private getErrorMessage(error: unknown): string {
    // Check error.response exists
    if (this.isAxiosError(error) && error.response) {
      // Attempt to parse as VirusTotalApiErrorResponse only if errorData is a non-null object
      const errorData = error.response.data;
      if (typeof errorData === 'object' && errorData !== null) {
        if (this.isApiErrorResponse(errorData)) {
          return `VirusTotal API Error (${errorData.error.code}): ${errorData.error.message}`;
        }
      }
      // Fallback for other types of errorData or if not a structured VT error
      return `HTTP ${error.response.status}: ${typeof errorData === 'string' ? errorData : JSON.stringify(errorData)}`;
    }
    if (error instanceof Error) {
      // Standard JavaScript Error
      return error.message;
    }
    try {
      // Fallback for other types
      return JSON.stringify(error);
    } catch {
      return String(error); // Final fallback
    }
  }

  // Helper to check if an error is an AxiosError (based on our mock interface)
  private isAxiosError(error: unknown): error is AxiosError {
    return (
      // typeof error === 'object' && error !== null && error.isAxiosError === true
      typeof error === 'object' &&
      error !== null &&
      (error as AxiosError).isAxiosError === true
    );
  }

  private parseErrorMessage(
    errorPayload: unknown,
    message: string,
    code: string,
  ): string[] {
    if (typeof errorPayload === 'object' && errorPayload !== null) {
      if (this.isApiErrorResponse(errorPayload)) {
        return [errorPayload.error.message, errorPayload.error.code];
      } else if (typeof (errorPayload as Error).message === 'string') {
        // Generic error object with a message property
        return [(errorPayload as Error).message, code];
      } else {
        // If it's an object but not a known error structure, stringify it
        return [JSON.stringify(errorPayload), code];
      }
    } else if (typeof errorPayload === 'string') {
      // If the payload is just a string
      return [errorPayload, code];
    }
    // If vtErrorPayload is null or undefined, return the original message and code
    return [message, code];
  }

  // Centralized error handler for VirusTotal API errors
  private handleVirusTotalError(error: unknown): never {
    // this.logger.error('VirusTotal operation failed. Details:', error);

    if (this.isAxiosError(error)) {
      // Check if it's an AxiosError first
      if (error.response) {
        // Server responded with a status code out of 2xx range
        const status = error.response.status;
        // Attempt to parse VirusTotal specific error from response.data
        const vtErrorPayload = error.response.data;

        // Try to extract VirusTotal specific error details if payload is an object
        const [vtErrorMessage, vtErrorCode] = this.parseErrorMessage(
          vtErrorPayload,
          'Unknown API error',
          'UnknownCode',
        );

        // const vtErrorMessage =
        //   typeof vtErrorPayload === 'object' && vtErrorPayload !== null
        //     ? this.isApiErrorResponse(vtErrorPayload)
        //       ? vtErrorPayload.error.message
        //       : typeof (vtErrorPayload as Error).message === 'string'
        //         ? (vtErrorPayload as Error).message
        //         : JSON.stringify(vtErrorPayload)
        //     : typeof vtErrorPayload === 'string'
        //       ? vtErrorPayload
        //       : 'Unknown API error';

        // const vtErrorCode =
        //   typeof vtErrorPayload === 'object' && vtErrorPayload !== null
        //     ? this.isApiErrorResponse(vtErrorPayload)
        //       ? vtErrorPayload.error.code
        //       : 'UnknownCode'
        //     : 'UnknownCode';

        this.logger.warn(
          `VirusTotal API Error (HTTP Status ${status}): Code: ${vtErrorCode}, Message: ${vtErrorMessage}`,
        );

        switch (status) {
          case statusCode.BAD_REQUEST: // Bad Request
            throw new Error(
              `Bad request to VirusTotal API: ${vtErrorMessage} (Code: ${vtErrorCode})`,
            );
          case statusCode.UNAUTHORIZED: // Unauthorized
            throw new Error(
              `Invalid or missing VirusTotal API key. (Code: ${vtErrorCode}, Message: ${vtErrorMessage})`,
            );
          case statusCode.FORBIDDEN: // Forbidden
            throw new Error(
              `Insufficient privileges for VirusTotal API operation. (Code: ${vtErrorCode}, Message: ${vtErrorMessage})`,
            );
          case statusCode.NOT_FOUND: // Not Found
            throw new Error(
              `VirusTotal resource not found. (Code: ${vtErrorCode}, Message: ${vtErrorMessage})`,
            );
          case statusCode.TOO_MANY_REQUESTS: // Too Many Requests
            throw new Error(
              `VirusTotal API rate limit exceeded. (Code: ${vtErrorCode}, Message: ${vtErrorMessage})`,
            );
          case statusCode.INTERNAL_SERVER_ERROR: // Internal Server Error
          case statusCode.BAD_GATEWAY: // Bad Gateway
          case statusCode.SERVICE_UNAVAILABLE: // Service Unavailable
          case statusCode.GATEWAY_TIMEOUT: // Gateway Timeout
            throw new Error(
              `VirusTotal server error (HTTP ${status}). (Code: ${vtErrorCode}, Message: ${vtErrorMessage})`,
            );
          default:
            throw new Error(
              `VirusTotal API request failed with HTTP status ${status}. (Code: ${vtErrorCode}, Message: ${vtErrorMessage})`,
            );
        }
      } else if (error.request) {
        // Request was made but no response received
        this.logger.error(
          'No response received from VirusTotal API:',
          error.request,
        );
        throw new Error(
          'No response received from VirusTotal. Check network connectivity.',
        );
      }
    }

    // Fallback for non-Axios errors or errors without response/request
    if (error instanceof Error) {
      this.logger.error(
        `Request setup or other client-side error: ${error.message}`,
      );
      throw new Error(`Request setup error: ${error.message}`);
    }

    // Truly unknown error
    this.logger.error('An unexpected error occurred:', error);
    throw new Error(
      `An unexpected error occurred: ${this.getErrorMessage(error)}`,
    );
  }
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
