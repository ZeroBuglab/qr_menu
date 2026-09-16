import { redirect } from "next/navigation";

export default function Home() {
  redirect("/menu/coffee-house?table=12");
}
