import { UsersService } from './users.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getMe(userId: string): Promise<Record<string, unknown>>;
    updateMe(userId: string, dto: UpdateProfileDto): Promise<Record<string, unknown>>;
}
