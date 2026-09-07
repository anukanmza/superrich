var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Controller, Get, Post, Body, Delete, Put, Param } from '@nestjs/common';
import { BillsService } from './bills.service.js';
let BillsController = class BillsController {
    billsService;
    constructor(billsService) {
        this.billsService = billsService;
    }
    findAll() {
        return this.billsService.findAll();
    }
    create(data) {
        return this.billsService.create(data);
    }
    getArchives() {
        return this.billsService.getArchives();
    }
    getArchiveById(id) {
        return this.billsService.getArchiveById(+id);
    }
    archiveCurrentPeriod(data) {
        return this.billsService.archiveCurrentPeriod(data.periodName, data.cutoutsJson, data.resultsJson);
    }
    remove(id) {
        return this.billsService.remove(+id);
    }
    update(id, data) {
        return this.billsService.update(+id, data);
    }
};
__decorate([
    Get(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BillsController.prototype, "findAll", null);
__decorate([
    Post(),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillsController.prototype, "create", null);
__decorate([
    Get('archives'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BillsController.prototype, "getArchives", null);
__decorate([
    Get('archives/:id'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BillsController.prototype, "getArchiveById", null);
__decorate([
    Post('archive'),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillsController.prototype, "archiveCurrentPeriod", null);
__decorate([
    Delete(':id'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BillsController.prototype, "remove", null);
__decorate([
    Put(':id'),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BillsController.prototype, "update", null);
BillsController = __decorate([
    Controller('bills'),
    __metadata("design:paramtypes", [BillsService])
], BillsController);
export { BillsController };
//# sourceMappingURL=bills.controller.js.map