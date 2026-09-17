/** One function: run SQL against the linked project over HTTPS. Never logs credentials. */

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export async function runSql<Row = Record<string, unknown>>(query: string): Promise<Row[]> {
  const ref = required("SUPABASE_PROJECT_REF");
  const token = required("SUPABASE_ACCESS_TOKEN");
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL request failed (${res.status}): ${text.slice(0, 500)}`);
  return text ? (JSON.parse(text) as Row[]) : [];
}
