/**
 * RSVP state of an invited guest.
 *
 * PENDING is the initial state (invited, no response yet). The other three are
 * the guest's answer. Kept as string values so they read clearly in the DB and
 * on the wire.
 */
export enum RsvpStatus {
  PENDING = 'PENDING',
  GOING = 'GOING',
  MAYBE = 'MAYBE',
  NOT_GOING = 'NOT_GOING',
}
