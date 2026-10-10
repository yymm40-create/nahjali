import { redirect } from "next/navigation";
import { requireOrder } from "@/lib/auth";
import { getCharacters } from "@/lib/orders";
import { BUCKETS, signedUrl } from "@/lib/supabase/admin";
import { bookletStep } from "@/lib/tables-booklet/server";
import CharacterPicker from "@/app/order/[id]/character/CharacterPicker";
import { TB } from "@config/tables-booklet";

export const dynamic = "force-dynamic";

export default async function BookletCharacterPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ generate?: string }> }) {
  const { id } = await params;
  const { generate } = await searchParams;
  const order = await requireOrder(id, `${TB.base}/${id}/character`);
  if (!["paid", "generating_character", "awaiting_approval"].includes(order.status)) redirect(bookletStep(order));

  const characters = await Promise.all(
    (await getCharacters(order.id))
      .filter((c) => c.base_image_path)
      .map(async (c) => ({ id: c.id, attempt: c.attempt_number, url: await signedUrl(BUCKETS.generated, c.base_image_path!) })),
  );

  return (
    <CharacterPicker
      key={characters.length}
      orderId={order.id}
      status={order.status}
      characters={characters}
      attemptsLeft={order.attempts_allowed - order.attempts_used}
      autoGenerate={generate === "1" && ["paid", "awaiting_approval"].includes(order.status) && order.attempts_used < order.attempts_allowed}
      base={`${TB.base}/${order.id}`}
    />
  );
}
