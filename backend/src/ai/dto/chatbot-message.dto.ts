import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class ChatbotMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  @IsString()
  @IsOptional()
  sessionId?: string;
}
