"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const http_exception_filter_js_1 = require("./filters/http-exception.filter.js");
const transform_interceptor_js_1 = require("./interceptors/transform.interceptor.js");
const logging_interceptor_js_1 = require("./interceptors/logging.interceptor.js");
const validation_pipe_js_1 = require("./pipes/validation.pipe.js");
let CommonModule = class CommonModule {
};
exports.CommonModule = CommonModule;
exports.CommonModule = CommonModule = __decorate([
    (0, common_1.Module)({
        providers: [
            {
                provide: core_1.APP_FILTER,
                useClass: http_exception_filter_js_1.HttpExceptionFilter,
            },
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: logging_interceptor_js_1.LoggingInterceptor,
            },
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: transform_interceptor_js_1.TransformInterceptor,
            },
            {
                provide: core_1.APP_PIPE,
                useValue: validation_pipe_js_1.AppValidationPipe,
            },
        ],
    })
], CommonModule);
//# sourceMappingURL=common.module.js.map