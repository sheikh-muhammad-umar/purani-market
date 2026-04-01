import { RecommendationService } from './recommendation.service.js';
import { ChatbotService } from './chatbot.service.js';
import { DismissRecommendationDto } from './dto/dismiss-recommendation.dto.js';
import { ChatbotMessageDto } from './dto/chatbot-message.dto.js';
export declare class AiController {
    private readonly recommendationService;
    private readonly chatbotService;
    constructor(recommendationService: RecommendationService, chatbotService: ChatbotService);
    getRecommendations(userId: string, lat?: string, lng?: string, limit?: string): Promise<{
        data: (import("mongoose").Document<unknown, {}, import("../listings/schemas/product-listing.schema.js").ProductListing, {}, import("mongoose").DefaultSchemaOptions> & import("../listings/schemas/product-listing.schema.js").ProductListing & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        } & {
            id: string;
        })[];
    }>;
    dismissRecommendation(userId: string, dto: DismissRecommendationDto): Promise<{
        message: string;
    }>;
    chatbotMessage(dto: ChatbotMessageDto): Promise<{
        sessionId: string;
        reply: string;
        escalated: boolean;
    }>;
}
