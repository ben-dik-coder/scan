import { createServiceClient } from "../src/lib/supabase/service.ts";

async function main() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("companies")
    .select(
      "orgnr,name,email,phone,mobile,municipality_name,city,website,industry_code,daglig_leder"
    )
    .or("municipality_name.ilike.%Narvik%,city.ilike.%Narvik%")
    .limit(500);

  if (error) throw new Error(error.message);

  const frisors = (data ?? []).filter(
    (c) =>
      (c.industry_code ?? "").startsWith("96.02") || /fris/i.test(c.name ?? "")
  );
  const noPhone = frisors.filter(
    (c) => !(c.mobile ?? "").trim() && !(c.phone ?? "").trim()
  );

  console.log(`Total frisør-lignende i Narvik: ${frisors.length}`);
  console.log(`Uten telefon: ${noPhone.length}\n`);

  for (const c of noPhone) {
    console.log(
      [
        c.orgnr,
        c.name,
        c.email ?? "-",
        c.daglig_leder ?? "-",
        c.website ?? "-",
      ].join(" | ")
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
