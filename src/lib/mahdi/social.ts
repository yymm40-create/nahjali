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
  /** what they read and their place in «تحدي القراءة», when they show it on their link (SQL 0126) */
  reading?: PublicReading | null;
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
  // light, like every screen since 26 November 2026 (the keys stay: they are saved with each story).
  // «green» keeps its key for old stories but is drawn lilac now (no green identity).
  gold: "radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--m-gold, #f5b400) 34%, #fff), color-mix(in srgb, var(--m-gold, #f5b400) 12%, #fff) 70%)",
  night: "radial-gradient(120% 120% at 50% 0%, #dbe7ff, #f5f8ff 70%)",
  green: "radial-gradient(120% 120% at 50% 0%, #e9e1ff, #f8f5ff 70%)",
  rose: "radial-gradient(120% 120% at 50% 0%, #ffdfe8, #fff6f8 70%)",
} as const;
export type StoryStyle = keyof typeof STORY_BACKGROUNDS;

/** «رابط حسابي»: what a person's public link shows of their reading (only when they turned it on). */
export interface PublicReading {
  /** pages read this month (in the person's own calendar) */
  monthPages: number;
  /** every page read since they started */
  totalPages: number;
  /** books finished */
  finished: number;
  /** what they are reading now (up to 3 titles) */
  now: string[];
  /** their place in «تحدي القراءة», when they joined the current (or last) one */
  challenge: { title: string; rank: number; total: number; pages: number; over: boolean } | null;
}
