import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ProductListing,
  ProductListingDocument,
  ListingStatus,
} from '../listings/schemas/product-listing.schema.js';
import {
  ShortVideo,
  ShortVideoDocument,
  ShortVideoStatus,
} from '../shorts/schemas/short-video.schema.js';
import {
  Conversation,
  ConversationDocument,
} from '../messaging/schemas/conversation.schema.js';
import {
  UserActivity,
  UserActivityDocument,
  UserAction,
} from '../ai/schemas/user-activity.schema.js';
import { ContactChannel } from './engagement.types.js';

/** Engagement figures for one listing or one short. */
export interface ItemEngagement {
  itemId: string;
  views: number;
  likes: number;
  /** Buyers who opened a chat. One per buyer, enforced by a unique index. */
  chats: number;
  calls: number;
  whatsapp: number;
  /**
   * How many distinct people tried to make contact, by any route.
   *
   * Deliberately not the sum of the columns above: one person who taps call
   * three times and then messages is a single lead, and counting clicks would
   * have told the seller they had four.
   */
  leads: number;
}

/** Identity used to tell one interested person from another. */
const LEAD_IDENTITY = {
  $ifNull: ['$userId', { $ifNull: ['$visitorId', '$sessionId'] }],
};

@Injectable()
export class EngagementService {
  constructor(
    @InjectModel(ProductListing.name)
    private readonly listingModel: Model<ProductListingDocument>,
    @InjectModel(ShortVideo.name)
    private readonly shortModel: Model<ShortVideoDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(UserActivity.name)
    private readonly activityModel: Model<UserActivityDocument>,
  ) {}

  /**
   * Engagement for every listing the seller owns.
   *
   * Batched on purpose. The listings screen shows up to fifty rows, and asking
   * per row would be fifty round trips of four queries each every time the page
   * loads.
   */
  async getListingEngagement(sellerId: string): Promise<ItemEngagement[]> {
    const sellerObjectId = new Types.ObjectId(sellerId);

    const listings = await this.listingModel
      .find({
        sellerId: sellerObjectId,
        status: { $ne: ListingStatus.DELETED },
      })
      .select('_id viewCount favoriteCount')
      .exec();

    if (listings.length === 0) return [];

    const ids = listings.map((listing) => listing._id);

    const [chats, contacts, leads] = await Promise.all([
      this.countChats('productListingId', ids),
      this.countContactsByChannel('productListingId', ids),
      this.countLeads('productListingId', ids),
    ]);

    return listings.map((listing) => {
      const id = listing._id.toString();
      const byChannel = contacts.get(id);
      return {
        itemId: id,
        views: listing.viewCount ?? 0,
        likes: listing.favoriteCount ?? 0,
        chats: chats.get(id) ?? 0,
        calls: byChannel?.get(ContactChannel.CALL) ?? 0,
        whatsapp: byChannel?.get(ContactChannel.WHATSAPP) ?? 0,
        leads: leads.get(id) ?? 0,
      };
    });
  }

  /** The same figures for the seller's shorts. */
  async getShortsEngagement(sellerId: string): Promise<ItemEngagement[]> {
    const sellerObjectId = new Types.ObjectId(sellerId);

    const shorts = await this.shortModel
      .find({
        sellerId: sellerObjectId,
        status: { $ne: ShortVideoStatus.DELETED },
      })
      .select('_id viewCount favoriteCount')
      .exec();

    if (shorts.length === 0) return [];

    const ids = shorts.map((short) => short._id);

    const [chats, contacts, leads] = await Promise.all([
      this.countChats('shortVideoId', ids),
      this.countContactsByChannel('shortVideoId', ids),
      this.countLeads('shortVideoId', ids),
    ]);

    return shorts.map((short) => {
      const id = short._id.toString();
      const byChannel = contacts.get(id);
      return {
        itemId: id,
        views: short.viewCount ?? 0,
        likes: short.favoriteCount ?? 0,
        chats: chats.get(id) ?? 0,
        calls: byChannel?.get(ContactChannel.CALL) ?? 0,
        whatsapp: byChannel?.get(ContactChannel.WHATSAPP) ?? 0,
        leads: leads.get(id) ?? 0,
      };
    });
  }

  /**
   * Chats per item, counted from conversations rather than from click events.
   *
   * Conversations carry a unique index per (buyer, seller, item), so this is an
   * exact count of buyers who actually opened a thread — and unlike the activity
   * collection it has no retention window, so it does not thin out over time.
   */
  private async countChats(
    field: 'productListingId' | 'shortVideoId',
    ids: Types.ObjectId[],
  ): Promise<Map<string, number>> {
    const rows = await this.conversationModel
      .aggregate<{
        _id: Types.ObjectId;
        count: number;
      }>([
        { $match: { [field]: { $in: ids } } },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      ])
      .exec();

    return new Map(rows.map((row) => [row._id.toString(), row.count]));
  }

  /**
   * Call and WhatsApp taps per item, split by channel.
   *
   * Listings record one `contact` action carrying the channel in
   * `metadata.type`; shorts have their own actions. Both are read here so the
   * seller sees the same two columns either way.
   */
  private async countContactsByChannel(
    field: 'productListingId' | 'shortVideoId',
    ids: Types.ObjectId[],
  ): Promise<Map<string, Map<ContactChannel, number>>> {
    const rows = await this.activityModel
      .aggregate<{
        _id: { itemId: Types.ObjectId; channel: string };
        count: number;
      }>([
        {
          $match: {
            [field]: { $in: ids },
            action: {
              $in: [
                UserAction.CONTACT,
                UserAction.SHORT_CALL_CLICK,
                UserAction.SHORT_CHAT_CLICK,
              ],
            },
          },
        },
        {
          $group: {
            _id: {
              itemId: `$${field}`,
              // A short's call action is its own event, so it has no
              // `metadata.type` to read.
              channel: {
                $cond: [
                  { $eq: ['$action', UserAction.SHORT_CALL_CLICK] },
                  ContactChannel.CALL,
                  {
                    $cond: [
                      { $eq: ['$action', UserAction.SHORT_CHAT_CLICK] },
                      ContactChannel.MESSAGE,
                      { $ifNull: ['$metadata.type', ContactChannel.MESSAGE] },
                    ],
                  },
                ],
              },
            },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    const byItem = new Map<string, Map<ContactChannel, number>>();
    for (const row of rows) {
      const id = row._id.itemId.toString();
      const channels = byItem.get(id) ?? new Map<ContactChannel, number>();
      channels.set(row._id.channel as ContactChannel, row.count);
      byItem.set(id, channels);
    }
    return byItem;
  }

  /**
   * Distinct people who tried to reach the seller about each item.
   *
   * Contact taps and opened chats are different collections, and someone who
   * does both is still one lead — so the two are merged with `$unionWith` and
   * de-duplicated by identity in a single pass, rather than added together.
   *
   * Identity falls back from account to browser to session, because most traffic
   * is not signed in; without the fallback every guest would collapse into one
   * lead.
   */
  private async countLeads(
    field: 'productListingId' | 'shortVideoId',
    ids: Types.ObjectId[],
  ): Promise<Map<string, number>> {
    const rows = await this.conversationModel
      .aggregate<{ _id: Types.ObjectId; leads: number }>([
        { $match: { [field]: { $in: ids } } },
        { $project: { itemId: `$${field}`, identity: '$buyerId' } },
        {
          $unionWith: {
            coll: 'user_activities',
            pipeline: [
              {
                $match: {
                  [field]: { $in: ids },
                  action: {
                    $in: [
                      UserAction.CONTACT,
                      UserAction.SHORT_CALL_CLICK,
                      UserAction.SHORT_CHAT_CLICK,
                    ],
                  },
                },
              },
              { $project: { itemId: `$${field}`, identity: LEAD_IDENTITY } },
            ],
          },
        },
        // An unidentifiable event cannot be told apart from any other, so it is
        // dropped instead of inflating the count.
        { $match: { identity: { $ne: null } } },
        { $group: { _id: '$itemId', identities: { $addToSet: '$identity' } } },
        { $project: { leads: { $size: '$identities' } } },
      ])
      .exec();

    return new Map(rows.map((row) => [row._id.toString(), row.leads]));
  }
}
