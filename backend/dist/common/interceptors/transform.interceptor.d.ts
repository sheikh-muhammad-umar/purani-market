import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
export interface WrappedResponse<T> {
    statusCode: number;
    data: T;
    timestamp: string;
}
export declare class TransformInterceptor<T> implements NestInterceptor<T, WrappedResponse<T>> {
    intercept(context: ExecutionContext, next: CallHandler<T>): Observable<WrappedResponse<T>>;
}
