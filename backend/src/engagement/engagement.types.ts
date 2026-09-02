/**
 * How a buyer tried to make contact.
 *
 * Mirrors the `metadata.type` values the listing detail page has always sent with
 * its `contact` events, so historical rows keep counting. Kept as its own leaf
 * module so both the service and its spec can name the channels without either
 * importing the other.
 */
export enum ContactChannel {
  MESSAGE = 'message',
  CALL = 'call',
  WHATSAPP = 'whatsapp',
}
