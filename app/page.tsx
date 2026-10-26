import { redirect } from "next/navigation";

/**
 * Үндсэн хуудсыг Нөхөн дүүргэлтийн төв рүү шилжүүлнэ.
 *
 * GS25 танилцуулгын үед localhost нээх мөчид шууд гол дэлгэц гарах ёстой.
 * Хуучин лог уншигч нь `/logs` дээр хэвээрээ байгаа (устгаагүй) — буцаахдаа
 * энэ файлыг `app/logs/page.tsx`-ээр солиод MainNav-ийн comment-ыг авна.
 */
export default function Home() {
  redirect("/sms");
}
