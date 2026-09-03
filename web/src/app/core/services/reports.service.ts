import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { API } from '../constants/api-endpoints';
import { ReportReason, ReportTargetType } from '../models/report.model';

export interface SubmitReportInput {
  targetType: ReportTargetType;
  targetId: string;
  message: string;
  reason?: ReportReason;
  screenshots?: File[];
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  constructor(private readonly api: ApiService) {}

  /**
   * File a report. Sent as multipart/form-data so screenshots ride along; the
   * browser sets the multipart boundary, so no Content-Type is set by hand.
   */
  submit(input: SubmitReportInput): Observable<unknown> {
    const fd = new FormData();
    fd.append('targetType', input.targetType);
    fd.append('targetId', input.targetId);
    fd.append('message', input.message);
    if (input.reason) fd.append('reason', input.reason);
    for (const file of input.screenshots ?? []) {
      fd.append('screenshots', file);
    }
    return this.api.post(API.REPORTS, fd);
  }
}
