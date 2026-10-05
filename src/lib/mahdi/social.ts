// «لأجل المهدي» · the community's people, posts, comments and stories as the browser sees them (shared types).
import { SOCIAL_VIDEO } from "@config/mahdi";
import type { SharePayload } from "./client/share";

export interface SocialUser {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  frame: string;
}

export type ReportCategory = "singing" | "indecent" | "abuse" | "other";
export const REPORT_CATEGORIES: ReportCategory[] = ["singing", "indecent", "abuse", "other"];

/** The new kinds of posts (the older ones are achievement cards built by the server). */
export type MediaPostKind = "photo" | "quote" | "video";
export const MEDIA_POST_KINDS: MediaPostKind[] = SOCIAL_VIDEO ? ["photo", "quote", "video"] : ["photo", "quote"];

export interface PostMedia {
  kind: "image" | "video";
  url: string;
  width: number | null;
  height: number | null;
  ms: number | null;
}

export interface PostView {
  id: string;
  mine: boolean;
  author: SocialUser;
  kind: string;
  /** Achievement cards. */
  payload: SharePayload | null;
  closing: string;
  caption: string;
  quote: { text: string; by: string } | null;
  media: PostMedia | null;
  createdAt: string;
  ahsant: number;
  ahsantByMe: boolean;
  comments: number;
  views: number;
}

export interface CommentView {
  id: string;
  mine: boolean;
  canDelete: boolean;
  author: SocialUser;
  body: string;
  createdAt: string;
}

export type FollowState = "self" | "following" | "pending" | "none";

export interface ProfileView {
  user: SocialUser;
  state: FollowState;
  followsMe: boolean;
  private: boolean;
  canSee: boolean;
  counts: { posts: number; followers: number; following: number };
  /** Only on my own page: people waiting for my answer. */
  requests?: SocialUser[];
}

export interface StoryView {
  id: string;
  kind: "photo" | "video" | "quote";
  media: PostMedia | null;
  text: string;
  style: string;
  createdAt: string;
  expiresAt: string;
  seen: boolean;
  /** Only for my own stories. */
  views?: number;
}

export interface StoryGroup {
  user: SocialUser;
  mine: boolean;
  stories: StoryView[];
  /** Has stories I have not seen yet. */
  fresh: boolean;
}

/** The backgrounds of text stories (the server keeps the same names). */
export const STORY_BACKGROUNDS = {
  gold: "radial-gradient(120% 120% at 50% 0%, #3a2f1c, #14110c 70%)",
  night: "radial-gradient(120% 120% at 50% 0%, #1b2440, #0b0e18 70%)",
  green: "radial-gradient(120% 120% at 50% 0%, #163a2c, #0a1510 70%)",
  rose: "radial-gradient(120% 120% at 50% 0%, #3a1c26, #150b0f 70%)",
} as const;
export type StoryStyle = keyof typeof STORY_BACKGROUNDS;
