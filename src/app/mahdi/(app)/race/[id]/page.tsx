"use client";

import { use } from "react";
import RaceRoom from "@/components/mahdi/race/RaceRoom";

export default function RaceRoomPage({ params }: { params: Promise<{ id: string }> }) {
  return <RaceRoom id={use(params).id} />;
}
