import HealthFrame from "@/components/mahdi/health/HealthFrame";

/**
 * «الصحة العلوية» is a part of «عاداتي»: it lives inside the app's own frame (the (app) layout: the account, the data,
 * the top bar and the five destinations), and only adds what its pages share.
 */
export default function HealthLayout({ children }: { children: React.ReactNode }) {
  return <HealthFrame>{children}</HealthFrame>;
}
