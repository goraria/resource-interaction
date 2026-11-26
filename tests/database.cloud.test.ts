import { beforeAll, beforeEach, afterEach, afterAll, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";
import { databaseUrl } from "@/utils/environment";
if (!databaseUrl) throw new Error("cloud_database_not_configured");
const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 15000 });
let client: PoolClient;
beforeAll(async () => { client = await pool.connect(); await client.query("BEGIN"); await client.query("SET LOCAL statement_timeout='15s'"); });
beforeEach(async () => { await client.query("SAVEPOINT fixture"); });
afterEach(async () => { if (client) { await client.query("ROLLBACK TO SAVEPOINT fixture"); await client.query("RELEASE SAVEPOINT fixture"); } });
afterAll(async () => { if (client) { await client.query("ROLLBACK"); client.release(); } await pool.end(); });

it("rejects Task snapshots with a lifetime over 120 seconds", async () => {
  await expect(client.query("INSERT INTO task_policy_projection(id,epoch,revision,snapshot_id,digest,issued_at,expires_at) VALUES('task',$1,1,$2,'fixture',now(),now()+interval '121 seconds')", [crypto.randomUUID(),crypto.randomUUID()])).rejects.toMatchObject({ code: "23514" });
});
it("rejects an invalid projection source or revision before it can replace live policy", async () => {
  await expect(client.query("INSERT INTO task_policy_projection(id,epoch,revision,snapshot_id,digest,issued_at,expires_at) VALUES('untrusted',$1,0,$2,'fixture',now(),now()+interval '60 seconds')", [crypto.randomUUID(),crypto.randomUUID()])).rejects.toMatchObject({ code: "23514" });
});
it("keeps the grant primary key unique for a page and subject", async () => {
  const page = crypto.randomUUID(), subject = "cloud-readiness-" + crypto.randomUUID();
  await client.query("INSERT INTO task_policy_grant(page_id,subject,comment) VALUES($1,$2,true)", [page,subject]);
  await expect(client.query("INSERT INTO task_policy_grant(page_id,subject,comment) VALUES($1,$2,false)",[page,subject])).rejects.toMatchObject({ code: "23505" });
});
it("permits independent subjects without sharing the comment grant", async () => {
  const page = crypto.randomUUID(), subject = "cloud-readiness-" + crypto.randomUUID();
  await client.query("INSERT INTO task_policy_grant(page_id,subject,comment) VALUES($1,$2,true),($1,$3,false)",[page,subject,subject+"-other"]);
  const { rows } = await client.query("SELECT subject,comment FROM task_policy_grant WHERE page_id=$1 ORDER BY subject",[page]);
  expect(rows).toEqual([{subject,comment:true},{subject:subject+"-other",comment:false}]);
});
