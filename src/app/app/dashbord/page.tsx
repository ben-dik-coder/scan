import { redirect } from "next/navigation";

/** Dashbord er erstattet av Analyse med undermenyer. */
export default function DashbordRedirectPage() {
  redirect("/app/analyse");
}
