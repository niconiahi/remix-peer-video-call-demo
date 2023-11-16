import { z } from "zod";

export const offerEventSchema = z.object({
  type: z.literal("offer"),
  sender: z.string(),
  sessionDescription: z.string(),
});
export type OfferEvent = z.infer<typeof offerEventSchema>;

export const answerEventSchema = z.object({
  type: z.literal("answer"),
  sender: z.string(),
  sessionDescription: z.string(),
});
export type AnswerEvent = z.infer<typeof answerEventSchema>;

export const candidateEventSchema = z.object({
  type: z.literal("candidate"),
  sender: z.string(),
  candidate: z.string(),
});
export type CandidateEvent = z.infer<typeof candidateEventSchema>;
export const gatheringEventSchema = z.object({
  type: z.literal("gathering"),
  sender: z.string(),
  candidate: z.string(),
});
export type GatheringEvent = z.infer<typeof gatheringEventSchema>;

export const eventSchema = z.discriminatedUnion("type", [
  offerEventSchema,
  answerEventSchema,
  candidateEventSchema,
  gatheringEventSchema,
]);
export type Event = z.infer<typeof eventSchema>;
