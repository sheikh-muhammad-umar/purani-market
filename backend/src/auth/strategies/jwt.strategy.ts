import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { User, UserDocument } from '../../users/schemas/user.schema.js';

export interface JwtPayload {
  sub: string;
  email?: string;
  phone?: string;
  role: string;
  permissions?: string[];
  type: 'access' | 'refresh';
  jti: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    const secret = configService.get<string>('jwt.secret');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    } as any);
  }

  async validate(req: any, payload: JwtPayload): Promise<JwtPayload> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Check if token is blacklisted
    const isBlacklisted = await this.redis.get(`bl:${payload.jti}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Fetch fresh role & permissions from DB (so super_admin changes take effect immediately)
    if (payload.role === 'admin' || payload.role === 'super_admin') {
      const user = await this.userModel.findById(payload.sub).select('role permissions').lean().exec();
      if (user) {
        payload.role = user.role;
        payload.permissions = user.permissions || [];
      }
    }

    return payload;
  }
}
