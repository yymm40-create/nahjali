import KhatmaTabs from "@/components/mahdi/khatma/KhatmaTabs";

export const metadata = { title: "الختمة العلوية" };

export default function KhatmaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <KhatmaTabs />
      {children}
    </div>
  );
}
