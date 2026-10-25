import GrowList from "@/components/mahdi/GrowList";
import { t } from "@/lib/mahdi/i18n";

export const metadata = { title: t.grow.title };

/** «تطوّر وازدهر»: the list of what the person intends to achieve. */
export default function GrowPage() {
  return <GrowList />;
}
