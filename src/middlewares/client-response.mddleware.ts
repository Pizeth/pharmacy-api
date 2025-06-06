import { Response } from 'express';
import statusCode from 'http-status-codes';

export const clientResponse = (
  res: Response,
  code: number,
  data: Error,
  message: string = 'Success',
) => {
  const form = {
    request: displayStatus(code),
    status: statusCode.getStatusText(code),
    message: message,
    data: data,
    ...(process.env.NODE_ENV === 'DEVELOPMENT' && {
      stack: data instanceof Error ? data.stack : null,
    }),
  };
  res.status(code).json(form);
};

function displayStatus(code: number): string {
  const statusGroups: Record<number, string> = {
    100: 'INFORMATIONAL',
    200: 'SUCCESS',
    300: 'REDIRECTION',
    400: 'CLIENT_ERROR',
    500: 'SERVER_ERROR',
  };

  // Get the first digit of the status code
  const firstDigit = Math.floor(code / 100) * 100;

  return statusGroups[firstDigit] || 'UNKNOWN_STATUS';
}

export default clientResponse;
