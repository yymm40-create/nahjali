// «لأجل المهدي» · the community's people, posts, comments and stories as the browser sees them (shared types).
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
export const MEDIA_POST_KINDS: MediaPostKind[] = ["photo", "quote", "video"];

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
