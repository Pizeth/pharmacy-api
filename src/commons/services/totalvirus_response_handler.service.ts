import { Injectable, Logger } from '@nestjs/common';
import { AxiosError } from 'axios';
import statusCodes from 'http-status-codes';
import {
  VirusTotalApiErrorResponse,
  VirusTotalResponse,
  VirusTotalAnalysisResponse,
} from 'src/types/virus_total';

@Injectable()
export class TotalVirusResponseHandlerService {
  private readonly logger = new Logger(TotalVirusResponseHandlerService.name);

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

  private isAnylysisResponse(
    report: unknown,
  ): report is VirusTotalAnalysisResponse {
    // Check if the report is an analysis response (bare or full)
    if (this.isApiErrorResponse(report)) return false; // Exclude errors first
    const potentialAnalysisResponse = report as VirusTotalAnalysisResponse;
    return (
      potentialAnalysisResponse.data !== undefined &&
      potentialAnalysisResponse.data.type === 'analysis' // Key differentiator
    );
  }

  // Checks if the report is a bare analysis object (from initial upload)
  public isBareAnalysisResponse(
    report: unknown,
  ): report is VirusTotalAnalysisResponse {
    if (this.isApiErrorResponse(report)) return false; // Exclude errors first
    return this.isAnylysisResponse(report) && !report.data.attributes; // Bare analysis response
  }

  // Checks if the report is a full analysis object (from polling)
  public isFullAnalysisResponse(
    report: unknown,
  ): report is VirusTotalAnalysisResponse {
    return (
      this.isAnylysisResponse(report) &&
      report.data.attributes !== undefined &&
      typeof report.data.attributes.status === 'string'
    ); // Full analysis response
  }

  // // Type Guard for successful file uploaded Response (VirusTotalFileUploadResponse)
  // public isFileUploadResponse(
  //   report: unknown,
  // ): report is VirusTotalFileUploadResponse {
  //   if (this.isApiErrorResponse(report)) return false; // Exclude errors first
  //   const potentialFileUploadReport = report as VirusTotalFileUploadResponse;
  //   return (
  //     potentialFileUploadReport.data !== undefined &&
  //     potentialFileUploadReport.data.type === 'analysis'
  //   ); // Specific to file upload attributes
  // }

  // // Type Guard for successful URL Analysis Response (VirusTotalUrlAnalysisResponse)
  // public isUrlAnalysisResponse(
  //   report: unknown,
  // ): report is VirusTotalUrlAnalysisResponse {
  //   if (this.isApiErrorResponse(report)) return false; // Exclude errors first
  //   const potentialUrlReport = report as VirusTotalUrlAnalysisResponse;
  //   return (
  //     potentialUrlReport.data !== undefined &&
  //     potentialUrlReport.data.type === 'analysis' && // Key differentiator
  //     potentialUrlReport.data.attributes !== undefined &&
  //     typeof potentialUrlReport.data.attributes.status === 'string'
  //   ); // Specific to URL analysis attributes
  // }

  // private getErrorMessage1(error: unknown): string {
  //   return error instanceof AxiosError
  //     ? error.message
  //     : error instanceof Error
  //       ? error.message
  //       : 'Unknown error';
  // }

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
  public isAxiosError(error: unknown): error is AxiosError {
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
  public handleVirusTotalError(error: unknown): never {
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
          case statusCodes.BAD_REQUEST: // Bad Request
            throw new Error(
              `Bad request to VirusTotal API: ${vtErrorMessage} (Code: ${vtErrorCode})`,
            );
          case statusCodes.UNAUTHORIZED: // Unauthorized
            throw new Error(
              `Invalid or missing VirusTotal API key. (Code: ${vtErrorCode}, Message: ${vtErrorMessage})`,
            );
          case statusCodes.FORBIDDEN: // Forbidden
            throw new Error(
              `Insufficient privileges for VirusTotal API operation. (Code: ${vtErrorCode}, Message: ${vtErrorMessage})`,
            );
          case statusCodes.NOT_FOUND: // Not Found
            throw new Error(
              `VirusTotal resource not found. (Code: ${vtErrorCode}, Message: ${vtErrorMessage})`,
            );
          case statusCodes.TOO_MANY_REQUESTS: // Too Many Requests
            throw new Error(
              `VirusTotal API rate limit exceeded. (Code: ${vtErrorCode}, Message: ${vtErrorMessage})`,
            );
          case statusCodes.INTERNAL_SERVER_ERROR: // Internal Server Error
          case statusCodes.BAD_GATEWAY: // Bad Gateway
          case statusCodes.SERVICE_UNAVAILABLE: // Service Unavailable
          case statusCodes.GATEWAY_TIMEOUT: // Gateway Timeout
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
