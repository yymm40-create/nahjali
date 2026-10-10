import type { QualityKey } from "@config/pricing";
import type { Gender } from "@config/prompts";
import type { StyleKey } from "@config/styles";

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "generating_character"
  | "awaiting_approval"
  | "generating_poses"
  | "composing"
  | "ready"
  | "failed";

export interface Order {
  id: string;
  user_id: string;
  template_id: string;
  status: OrderStatus;
  amount_halalas: number;
  moyasar_payment_id: string | null;
  attempts_allowed: number;
  attempts_used: number;
  quality: QualityKey;
  is_trial: boolean;
  child_name: string | null;
  child_gender: Gender | null;
  style: StyleKey;
  parent_message: string | null;
  /** «كتيب الجداول الذكي»: who the booklet is for, and its design (see src/lib/tables-booklet/server.ts) */
  spec?: unknown;
  created_at: string;
  updated_at: string;
}

export interface Character {
  id: string;
  order_id: string;
  source_image_path: string;
  base_image_path: string | null;
  attempt_number: number;
  is_approved: boolean;
  created_at: string;
}

export interface Pose {
  id: string;
  character_id: string;
  pose_key: string;
  image_path: string | null;
  status: "pending" | "done" | "failed";
  attempts: number;
  started_at: string | null;
}

export const PAID_STATUSES: OrderStatus[] = [
  "paid",
  "generating_character",
  "awaiting_approval",
  "generating_poses",
  "composing",
  "ready",
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "بانتظار الدفع",
  paid: "بانتظار صورتك",
  generating_character: "نصمم شخصيتك",
  awaiting_approval: "بانتظار اعتمادك للشخصية",
  generating_poses: "نجهّز الوضعيات",
  composing: "نركّب الكتيب",
  ready: "جاهز للتحميل",
  failed: "تعذّر الإكمال",
};

/** The page a customer should be on for each order status. */
export function stepPath(order: Pick<Order, "id" | "status">) {
  switch (order.status) {
    case "pending_payment":
      return `/new?order=${order.id}`;
    case "paid":
      return `/order/${order.id}/upload`;
    case "generating_character":
    case "awaiting_approval":
      return `/order/${order.id}/character`;
    case "ready":
      return `/order/${order.id}/download`;
    default:
      return `/order/${order.id}/progress`;
  }
}
