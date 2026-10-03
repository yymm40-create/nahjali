// Data shapes shared by the server, the browser store and (later) a native app.
import type { MahdiTheme, ProjectColor } from "@config/mahdi";
import type { ISODate, Version } from "./engine";

export interface Shrine {
  id: string;
  name: string;
  place: string;
  /** null = no picture yet (shown as «قريبًا»). */
  imageUrl: string | null;
  imageAlt: string;
  /** CSS object-position, the picture's focal point. */
  imagePosition: string;
  imageCredit: string;
  isArtwork: boolean;
  active: boolean;
}

export interface Profile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  shrineId: string;
  theme: MahdiTheme;
  themeVariant: string;
  timeZone: string;
  /** 0 = Sunday … 6 = Saturday */
  weekStart: number;
  showHijri: boolean;
  hijriOffset: number;
  frame: string;
  viewMode: "list" | "compact";
}

export interface Project {
  id: string;
  name: string;
  icon: string;
  color: ProjectColor;
  sortOrder: number;
  archivedAt: string | null;
}

export interface Habit {
  id: string;
  projectId: string;
  name: string;
  icon: string;
  category: string;
  notes: string;
  /** 'HH:MM' or null */
  reminderTime: string | null;
  sortOrder: number;
  /** Oldest first. */
  versions: Version[];
}

export type PhraseContext = "home" | "day_complete" | "weekly" | "monthly" | "comeback" | "milestone" | "notification";

/** An original motivational line written for the app (not attributed to anyone). */
export interface Phrase {
  id: string;
  text: string;
  contexts: PhraseContext[];
}

/** Everything the app needs on the device. */
export interface Snapshot {
  profile: Profile;
  shrines: Shrine[];
  phrases: Phrase[];
  rewards: UnlockedReward[];
  privacy: Privacy;
  challenges: ChallengeData;
  notifications: NotificationSettings;
  projects: Project[];
  habits: Habit[];
  /** habitId → date → value. Only days from `logsFrom` on. */
  logs: Record<string, Record<ISODate, number>>;
  logsFrom: ISODate;
  /** The user's "today" when the snapshot was made. */
  today: ISODate;
}

/** One logged value sent to the server ("set this day's total to value"). */
export interface LogOp {
  habitId: string;
  date: ISODate;
  value: number;
  /** When the user made the change (ms since epoch); the newest change wins. */
  ts: number;
}

export interface UnlockedReward {
  milestoneId: string;
  unlockedAt: string;
  seenAt: string | null;
}

/** Everything is private until the user turns it on. */
export interface Privacy {
  community: boolean;
  leaderboard: boolean;
  showAvatar: boolean;
}

export interface ChallengeSection {
  id: string;
  name: string;
  description: string;
  icon: string;
}

/** A unified challenge, defined by the admin; everyone follows the same definition. */
export interface Challenge {
  id: string;
  sectionId: string;
  title: string;
  description: string;
  rules: string;
  measure: "check" | "count" | "amount";
  target: number;
  unit: string;
  freq: "daily" | "weekly" | "monthly";
  startsOn: string;
  endsOn: string | null;
  leaderboard: boolean;
}

export interface Membership {
  challengeId: string;
  joinedOn: string;
  leftOn: string | null;
  onLeaderboard: boolean;
}

export interface ChallengeData {
  sections: ChallengeSection[];
  list: Challenge[];
  memberships: Membership[];
  /** challengeId → date → value */
  logs: Record<string, Record<string, number>>;
}

export interface NotificationSettings {
  mode: "off" | "daily" | "every_12h" | "every_6h" | "custom";
  times: string[];
  quietStart: string;
  quietEnd: string;
  habitReminders: boolean;
}
