import { z } from "zod"

import { metadataSchema, paginationSchema } from "@/schemas/common"

export const reactionTypeSchema = z.enum([
  "like",
  "dislike",
  "love",
  "haha",
  "wow",
  "sad",
  "angry",
  "upvote",
  "downvote",
])

export const saveTypeSchema = z.enum(["bookmark", "favorite"])
export const notificationLevelSchema = z.enum(["none", "personalized", "all"])
export const shareChannelSchema = z.enum(["internal", "link", "email", "external"])

export const reactionSchema = z.object({ type: reactionTypeSchema })
export const followSchema = z.object({
  notificationLevel: notificationLevelSchema.default("personalized"),
})
export const subscriptionSchema = z.object({
  notificationLevel: notificationLevelSchema.default("all"),
})
export const voteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]),
})
export const saveSchema = z.object({ metadata: metadataSchema.optional() })
export const ratingSchema = z.object({ value: z.number().min(1).max(5) })
export const shareSchema = z.object({
  channel: shareChannelSchema.default("link"),
  destination: z.string().trim().max(2048).nullable().optional(),
  metadata: metadataSchema.optional(),
})
export const listMineSchema = paginationSchema

export type ReactionInput = z.infer<typeof reactionSchema>
export type FollowInput = z.infer<typeof followSchema>
export type SubscriptionInput = z.infer<typeof subscriptionSchema>
export type VoteInput = z.infer<typeof voteSchema>
export type SaveInput = z.infer<typeof saveSchema>
export type RatingInput = z.infer<typeof ratingSchema>
export type ShareInput = z.infer<typeof shareSchema>
