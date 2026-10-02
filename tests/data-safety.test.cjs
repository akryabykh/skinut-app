const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { PGlite } = require("@electric-sql/pglite");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
function loadTS(file, requireMock = require) {
  const module = { exports: {} };
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: requireMock, console, setTimeout, clearTimeout });
  return module.exports;
}
const { ProjectSaveQueue } = loadTS("lib/project-save-queue.ts");
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("save queue serializes requests, coalesces pending edits, advances version", async () => {
  const calls = [], outcomes = [];
  let finish;
  const queue = new ProjectSaveQueue("v1", (value, version) => {
    calls.push([value, version]);
    return new Promise((resolve) => { finish = resolve; });
  }, (result, pending) => outcomes.push([result, pending]));
  queue.enqueue("A"); queue.enqueue("B"); queue.enqueue("C");
  assert.deepEqual(calls, [["A", "v1"]]);
  finish({ ok: true, updatedAt: "v2" }); await tick();
  assert.deepEqual(calls, [["A", "v1"], ["C", "v2"]]);
  assert.equal(outcomes[0][1], true);
  finish({ ok: true, updatedAt: "v3" }); await tick();
  assert.equal(outcomes[1][1], false);
});

test("a conflict pauses newer saves without retrying with a fresh server version", async () => {
  let calls = 0;
  const queue = new ProjectSaveQueue("v1", async () => {
    calls++; return { ok: false, reason: "conflict", message: "Conflict" };
  }, () => {});
  queue.enqueue("first"); await tick(); queue.enqueue("newer"); await tick();
  assert.equal(calls, 1);
});

test("network retry sends the newest draft with the last acknowledged version", async () => {
  const calls = [];
  const queue = new ProjectSaveQueue("v1", async (value, version) => {
    calls.push([value, version]);
    if (calls.length === 1) throw new Error("offline");
    return { ok: true, updatedAt: "v2" };
  }, () => {});
  queue.enqueue("first"); await tick(); queue.enqueue("latest"); queue.retry(); await tick();
  assert.deepEqual(calls, [["first", "v1"], ["latest", "v1"]]);
});

test("database migration: conflicts, link access, ownership, RPC permissions", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key, email text not null, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      grant usage on schema auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
    `);
    await db.exec(read("supabase/schema.sql"));
    const migrations = fs.readdirSync(path.join(root, "supabase/migrations")).sort();
    for (const file of migrations.filter((f) => !f.startsWith("20261002"))) {
      await db.exec(read(`supabase/migrations/${file}`));
    }
    const a = "00000000-0000-0000-0000-000000000001";
    const b = "00000000-0000-0000-0000-000000000002";
    await db.query("insert into auth.users(id,email) values ($1,'a@test.invalid'),($2,'b@test.invalid')", [a,b]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [a]);
    const created = await db.query("select public.create_app_project('Test','RUB',null) as id");
    const id = created.rows[0].id;
    await db.query("insert into public.project_members(project_id,user_id,role) values ($1,$2,'editor')", [id,b]);
    // Reproduce a pre-existing bad transfer, then apply the repair.
    await db.query("select public.transfer_project_ownership($1,$2)", [id,b]);
    assert.equal((await db.query("select owner_id from app_projects where id=$1",[id])).rows[0].owner_id,a);
    await db.query("select upsert_exchange_rate('USD','RUB',99999)");
    await db.exec(read("supabase/migrations/20261002000001_project_data_safety.sql"));
    await db.exec("grant select, insert, update, delete on all tables in schema public to authenticated, service_role; grant select on exchange_rates_cache to anon;");

    await t.test("old transfers repaired and deleting former owner preserves project", async () => {
      assert.equal((await db.query("select owner_id from app_projects where id=$1",[id])).rows[0].owner_id,b);
      await db.query("delete from auth.users where id=$1",[a]);
      assert.equal((await db.query("select id from app_projects where id=$1",[id])).rows.length,1);
    });
    await t.test("new transfer changes both roles and FK; non-owner rejected", async () => {
      const c="00000000-0000-0000-0000-000000000003";
      await db.query("insert into auth.users(id,email) values ($1,'c@test.invalid')",[c]);
      await db.query("insert into project_members(project_id,user_id,role) values ($1,$2,'editor')",[id,c]);
      await db.query("select set_config('request.jwt.claim.sub', $1, false)",[c]);
      await assert.rejects(db.query("select transfer_project_ownership($1,$2)",[id,b]),/Only the current owner/);
      await db.query("select set_config('request.jwt.claim.sub', $1, false)",[b]);
      await db.query("select transfer_project_ownership($1,$2)",[id,c]);
      assert.equal((await db.query("select owner_id from app_projects where id=$1",[id])).rows[0].owner_id,c);
      assert.equal((await db.query("select role from project_members where project_id=$1 and user_id=$2",[id,b])).rows[0].role,"editor");
      await db.query("delete from auth.users where id=$1",[b]);
      assert.equal((await db.query("select id from app_projects where id=$1",[id])).rows.length,1);
      await db.query("select set_config('request.jwt.claim.sub', $1, false)",[c]);
    });
    await t.test("account saves reject stale revisions under real RLS", async () => {
      const { rows } = await db.query("select updated_at::text as version from app_projects where id=$1",[id]);
      const version=rows[0].version;
      await db.exec("set role authenticated");
      const write="update app_projects set payload=$2::jsonb where id=$1 and updated_at=$3::timestamptz returning updated_at::text as version";
      const first=await db.query(write,[id,JSON.stringify({expenses:[{id:'first'}]}),version]);
      assert.equal(first.rows.length,1);
      const stale=await db.query(write,[id,JSON.stringify({expenses:[{id:'stale'}]}),version]);
      assert.equal(stale.rows.length,0);
      assert.equal((await db.query("select payload from app_projects where id=$1",[id])).rows[0].payload.expenses[0].id,"first");
      await db.exec("reset role");
    });
    await t.test("sharing metadata doesn't invalidate content, currencies do", async () => {
      const version=(await db.query("select updated_at::text as version from app_projects where id=$1",[id])).rows[0].version;
      await db.query("update app_projects set share_token=gen_random_uuid() where id=$1",[id]);
      assert.equal((await db.query("select updated_at::text as version from app_projects where id=$1",[id])).rows[0].version,version);
      await db.query("update app_projects set secondary_currency='USD',manual_rate=80 where id=$1",[id]);
      assert.notEqual((await db.query("select updated_at::text as version from app_projects where id=$1",[id])).rows[0].version,version);
    });
    await t.test("link saves reject stale/invalid/expired tokens and keep claimed links", async () => {
      await db.exec("set role anon");
      const token=(await db.query("select create_anon_project() as token")).rows[0].token;
      const row=(await db.query("select updated_at::text as version from get_anon_project($1)",[token])).rows[0];
      const save="select updated_at::text as version, expires_at from save_anon_project($1,$2::jsonb,$3::timestamptz,'Test')";
      const first=await db.query(save,[token,JSON.stringify({expenses:[{id:'first'}]}),row.version]);
      assert.equal(first.rows.length,1); assert.ok(first.rows[0].expires_at);
      assert.equal((await db.query(save,[token,'{}',row.version])).rows.length,0);
      assert.equal((await db.query(save,[a,'{}',first.rows[0].version])).rows.length,0);
      await assert.rejects(db.query(save,[token,'{}',null]),/Expected version/);
      await db.exec("reset role");
      await db.query("select claim_anon_project($1)",[token]);
      await db.exec("set role anon");
      const claimed=(await db.query("select updated_at::text as version from get_anon_project($1)",[token])).rows[0];
      assert.equal((await db.query(save,[token,'{}',claimed.version])).rows[0].expires_at,null);
      await db.exec("reset role");
      const expired=(await db.query("select create_anon_project() as token")).rows[0].token;
      await db.query("update app_projects set expires_at=now()-interval '1 day' where edit_token=$1",[expired]);
      const expiredVersion=(await db.query("select updated_at::text as version from app_projects where edit_token=$1",[expired])).rows[0].version;
      await db.exec("set role anon");
      assert.equal((await db.query(save,[expired,'{}',expiredVersion])).rows.length,0);
      await db.exec("reset role");
    });
    await t.test("PUBLIC, anon and authenticated cannot poison rates or use unversioned link saves", async () => {
      assert.equal((await db.query("select count(*)::int as n from exchange_rates_cache")).rows[0].n,0);
      for (const role of ["anon","authenticated"]) {
        await db.exec(`set role ${role}`);
        await assert.rejects(db.query("select upsert_exchange_rate('USD','RUB',99999)"),/permission denied/);
        await assert.rejects(db.query("select update_anon_project($1,'{}',null)",[a]),/permission denied/);
        await db.exec("reset role");
      }
      await db.exec("create role untrusted; set role untrusted;");
      await assert.rejects(db.query("select upsert_exchange_rate('USD','RUB',99999)"),/permission denied/);
      await db.exec("reset role; set role service_role");
      await db.query("select upsert_exchange_rate('USD','RUB',80)");
      assert.equal(Number((await db.query("select rate from exchange_rates_cache")).rows[0].rate),80);
      await db.exec("reset role");
    });
    await t.test("migration can be applied again", async () => {
      await db.exec(read("supabase/migrations/20261002000001_project_data_safety.sql"));
    });
  } finally { await db.close(); }
});

test("service worker never caches private responses; clears only its own legacy caches", async () => {
  const handlers={}, stored=new Map(),deleted=[];
  let online=true;
  const cache={addAll:async()=>{},put:async(req,res)=>stored.set(req.url,res)};
  const scope={ self:{location:{origin:"https://app.test"}, clients:{claim:async()=>{}}, skipWaiting:async()=>{},addEventListener:(event,fn)=>handlers[event]=fn},
    caches:{open:async()=>cache, match:async(req)=>stored.get(req.url), keys:async()=>["split-app-next-v1","split-app-next-v2","other-app"],delete:async(name)=>deleted.push(name)},
    fetch:async()=>{if(!online)throw new Error("offline");return new Response("private",{status:200});}, URL, Response};
  // Node responses don't have browser type=basic; model the successful browser response.
  scope.fetch=async()=>{if(!online)throw new Error("offline");return {ok:true,type:"basic",status:200,clone(){return this}}};
  vm.runInNewContext(read("public/sw.js"),scope);
  let activate; handlers.activate({waitUntil:p=>activate=p});await activate;
  assert.deepEqual(deleted,["split-app-next-v1"]);
  async function request(url,mode="cors") {
    const pending=[];let response;
    handlers.fetch({request:{method:"GET",url,mode},respondWith:p=>response=p,waitUntil:p=>pending.push(p)});
    const result=await response;await Promise.all(pending);return result;
  }
  for(const pathname of ["/account","/app/projects","/app?project=1","/p/token","/share/token","/auth/callback?code=test"]) {
    await request("https://app.test"+pathname);
  }
  await request("https://supabase.test/rest/v1/app_projects");
  assert.equal(stored.size,0);
  await request("https://app.test/_next/static/chunk.js");
  assert.equal(stored.size,1);
  online=false;
  assert.equal((await request("https://app.test/_next/static/chunk.js")).status,200);
  assert.equal((await request("https://app.test/app/projects","navigate")).status,503);
});
