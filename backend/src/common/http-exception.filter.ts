import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import type { Request, Response } from "express";
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (exception as any)?.code === "P0001" &&
            (exception as any)?.message === "DT_OPERATION_PAUSED"
          ? 503
          : ["40P01", "40001", "55P03"].includes((exception as any)?.code)
            ? 503
            : (exception as any)?.type === "entity.too.large"
              ? 413
              : 500;
    // Only these numeric policy messages are safe to return; other errors stay redacted.
    const policyMessage = status === 400 && exception instanceof HttpException &&
      /^(Minimum deposit is \d{1,12}(?:\.\d{1,6})? USDT\.|Daily deposit limit of \d{1,12}(?:\.\d{1,6})? USDT would be exceeded\.)$/.test(exception.message)
      ? exception.message : null;
    // Release enforcement is not an account/KYC decision. Keep the same 403
    // and guard, but expose a fixed, non-sensitive reason to clients.
    const releaseRequired = status === 403 && exception instanceof HttpException &&
      exception.message === "Update Required";
    const depositMessages: Record<string, string> = {
      'Service temporarily paused': 'Deposit submissions are paused. Please try again later.',
      'Transaction already submitted or credited': 'This TxID has already been submitted or credited.',
      'Proof unavailable': 'Deposit proof is unavailable. Please select and upload it again.',
      'Deposit proof required': 'Attach your deposit proof before submitting.',
      'Active account required': 'Your account is not eligible to submit deposits. Contact support.',
      'Account requires review': 'Your account requires review. Contact support.',
    };
    const depositMessage = req.path.startsWith('/api/v1/manual/deposits') &&
      exception instanceof HttpException ? depositMessages[exception.message] : undefined;
    const recentAuthRequired = status === 403 && exception instanceof HttpException && exception.message === 'ADMIN_RECENT_AUTH_REQUIRED';
    res.status(status).json({
      error: {
        code: recentAuthRequired ? 'ADMIN_RECENT_AUTH_REQUIRED' : releaseRequired ? "ANDROID_RELEASE_REQUIRED" : `HTTP_${status}`,
        message: recentAuthRequired ? 'Confirm a fresh authenticator code to view sensitive bank details.' : releaseRequired
          ? "Transactions are unavailable until an approved Android release is enabled."
          : depositMessage ?? policyMessage ?? (
          status === 500
            ? "An unexpected error occurred"
            : status === 503
              ? "Service is not ready"
              : status === 400
                ? "Check the request details and account limits"
                : status === 401
                  ? "Sign in again or check your credentials"
                  : status === 403
                    ? "Account verification or review is required"
                    : status === 404
                      ? "Resource not found"
                      : status === 409
                        ? "Request conflicts with existing data"
                        : status === 429
                          ? "Too many attempts. Please try again later"
                          : "Request could not be processed"),
      },
      requestId: res.getHeader("x-request-id"),
      path: req.path,
    });
  }
}
