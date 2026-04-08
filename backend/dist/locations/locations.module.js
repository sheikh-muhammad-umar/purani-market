"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const pakistan_location_schema_js_1 = require("./schemas/pakistan-location.schema.js");
const locations_service_js_1 = require("./locations.service.js");
const locations_controller_js_1 = require("./locations.controller.js");
let LocationsModule = class LocationsModule {
};
exports.LocationsModule = LocationsModule;
exports.LocationsModule = LocationsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: pakistan_location_schema_js_1.PakistanLocation.name, schema: pakistan_location_schema_js_1.PakistanLocationSchema },
            ]),
        ],
        controllers: [locations_controller_js_1.LocationsController],
        providers: [locations_service_js_1.LocationsService],
        exports: [locations_service_js_1.LocationsService],
    })
], LocationsModule);
//# sourceMappingURL=locations.module.js.map