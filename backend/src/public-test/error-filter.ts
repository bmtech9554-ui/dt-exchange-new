import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { HttpErrorFilter } from '../common/http-exception.filter';

/** Translate only known, test-only database capacity/identity guards. */
@Catch()
export class PublicTestErrorFilter extends HttpErrorFilter {
  override catch(error: unknown, host: ArgumentsHost) {
    const e = error as { code?: string; message?: string };
    const statuses: Record<string, number> = {
      TEST_REFERENCE_REQUIRED: 400,
      DEMO_BANK_ONLY: 400,
      TEST_FILE_MAX_1MB: 413,
      TEST_USER_FILE_CAP: 409,
      TEST_STORAGE_CAPACITY_REACHED: 409,
      TEST_CAPACITY_REACHED: 409,
    };
    const status = e?.code === 'P0001' ? statuses[e.message ?? ''] : undefined;
    super.catch(status ? new HttpException('Test input or capacity limit', status) : error, host);
  }
}
