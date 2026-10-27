import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { SITE, whatsappHref } from "@/lib/site";
import s from "./FloatingWhatsApp.module.css";

export async function FloatingWhatsApp() {
  const t = await getTranslations("footer");
  return <a href={whatsappHref(t("whatsappMessage"))} target="_blank" rel="noopener noreferrer" className={s.button} aria-label={t("whatsapp", { number: SITE.whatsapp.display })}>
    <span className={s.label}>{t("whatsappHelp")}</span>
    <Image src="/icons/whatsapp.svg" width={34} height={34} alt="" className={s.icon} />
    <span className="sr-only">WhatsApp</span>
  </a>;
}
