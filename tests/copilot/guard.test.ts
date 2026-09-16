import { describe, expect, it } from "vitest";
import { guardSql } from "@/lib/copilot/guard";

const rejects = (sql: string, reason: RegExp) => {
  const result = guardSql(sql);
  expect(result.ok, sql).toBe(false);
  if (!result.ok) expect(result.reason).toMatch(reason);
};

describe("guardSql", () => {
  it("accepts a plain select, a CTE select, and strips one trailing semicolon", () => {
    expect(guardSql("select id, state from kits where state = 'results_locked'")).toEqual({ ok: true, sql: "select id, state from kits where state = 'results_locked'" });
    expect(guardSql("  SELECT count(*) FROM tickets;  ").ok).toBe(true);
    expect(guardSql("with s as (select state, count(*) n from kits group by 1) select * from s order by n desc").ok).toBe(true);
  });

  it("rejects writes", () => {
    rejects("update tickets set status = 'resolved'", /SELECT/);
    rejects("delete from tickets", /SELECT/);
    rejects("insert into tickets values (1)", /SELECT/);
    rejects("with x as (delete from tickets returning id) select * from x", /delete/);
    rejects("with x as (insert into tickets (id) values (1) returning id) select * from x", /insert/);
    rejects("select 1 from (update tickets set status = 'open' returning 1) t", /update/);
  });

  it("rejects multiple statements and comments", () => {
    rejects("select 1; select 2", /one statement/);
    rejects("select 1; drop table kits", /one statement/);
    rejects("select 1 -- drop table kits", /Comments/);
    rejects("select /* hidden */ 1", /Comments/);
  });

  it("rejects sleeping, file access, settings, locks and select into", () => {
    rejects("select pg_sleep(10)", /pg_sleep/);
    rejects("select pg_read_file('/etc/passwd')", /pg_read_file/);
    rejects("select set_config('role', 'postgres', false)", /set_config/);
    rejects("select * from kits for update", /locks/);
    rejects("select * into scratch from kits", /into/);
    rejects("copy kits to '/tmp/x'", /SELECT/);
  });

  it("rejects empty and oversized queries", () => {
    rejects("", /Empty/);
    rejects("   ;  ", /Empty/);
    rejects("select " + "1, ".repeat(2000) + "1", /longer/);
  });

  it("does not trip on column names that contain keywords", () => {
    expect(guardSql("select offset_hours, updated_by, status from kits").ok).toBe(true);
  });
});
