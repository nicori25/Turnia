import test, { before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const migration = await readFile(new URL('../supabase/migrations/20261119_reservas_persistentes.sql', import.meta.url), 'utf8')
const legacy = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222'
const bootstrap = `create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`
let db, serviceA, serviceB
async function asRole(role, uid, sql, params = []) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid ?? ''])
  await db.exec(`set role ${role}`)
  try { return await db.query(sql, params) } finally { await db.exec('reset role') }
}
let tokenCounter = 1
const token = () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(tokenCounter++).padStart(12, '0')}`
const request = (service = serviceA, overrides = {}) => asRole('anon', null,
 'select public.turnia_solicitar($1,$2::date,$3::time,$4,$5,$6,$7::uuid) as receipt',
 [service, overrides.date ?? '2099-05-01', overrides.time ?? '10:00', overrides.name ?? 'Cliente Prueba', overrides.phone ?? '1112345678', overrides.vip ?? false, overrides.token ?? token()])
const change = (owner, id, state) => asRole('authenticated',owner,'select public.turnia_estado($1::uuid,$2) as receipt',[id,state])
before(async () => {
 db = new PGlite()
 await db.exec(bootstrap)
 await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2),($3,$4)', [a,{business_name:'Local A'},b,{business_name:'Local B'}])
 await db.exec(legacy)
 await db.exec(migration)
 await db.exec(migration)
 const rows = (await db.query('select id,barbero_id from public.servicios order by precio')).rows
 serviceA = rows.find((s) => s.barbero_id === a).id
 serviceB = rows.find((s) => s.barbero_id === b).id
})
beforeEach(async () => { await db.exec('delete from public.turnos') })
after(async () => { await db.close() })

test('legacy upgrade is repeatable, backfills profiles and seeds services once', async () => {
 assert.equal((await db.query('select count(*)::int as n from public.barberos')).rows[0].n,2)
 assert.equal((await db.query('select count(*)::int as n from public.servicios')).rows[0].n,6)
 const rows = (await asRole('anon',null,'select * from public.turnia_locales()')).rows
 assert.deepEqual(Object.keys(rows[0]).sort(),['business_name','id'])
})
test('public request persists with server-computed price and idempotent receipt', async () => {
 const key = token()
 const first = (await request(serviceA,{vip:true,token:key})).rows[0].receipt
 const again = (await request(serviceA,{vip:true,token:key})).rows[0].receipt
 assert.equal(first.id,again.id)
 assert.equal(first.estado,'pendiente')
 assert.equal(first.precio_total,4500) // cheapest service is Barba (3000) + VIP (1500)
 assert.equal((await db.query('select count(*)::int as n from public.turnos')).rows[0].n,1)
 await assert.rejects(request(serviceA,{phone:'1199999999',token:key}),/ya utilizado/)
})
test('anonymous users cannot read clients or write arbitrary table records', async () => {
 await request()
 await assert.rejects(asRole('anon',null,'select * from public.turnos'),/permission denied/)
 await assert.rejects(asRole('anon',null,"update public.turnos set estado='confirmado'"),/permission denied/)
 await assert.rejects(asRole('anon',null,'select public.turnia_estado($1,$2)',[token(),'confirmado']),/permission denied/)
})
test('owner-only RLS and status RPC prevent cross-business access', async () => {
 const ta=(await request()).rows[0].receipt
 await request(serviceB)
 const own=(await asRole('authenticated',a,'select id from public.turnos')).rows
 assert.deepEqual(own.map((t)=>t.id),[ta.id])
 await assert.rejects(change(b,ta.id,'confirmado'),/sin permiso/)
 await assert.rejects(asRole('authenticated',a,"update public.turnos set estado='confirmado'"),/permission denied/)
})
test('only one pending request can be accepted; cancellation frees the public slot', async () => {
 const first=(await request()).rows[0].receipt, second=(await request()).rows[0].receipt
 await change(a,first.id,'confirmado')
 await assert.rejects(change(a,second.id,'confirmado'),/ocupado/)
 await assert.rejects(request(),/ocupado/)
 const occupied=(await asRole('anon',null,'select * from public.turnia_ocupados($1,$2::date)',[a,'2099-05-01'])).rows
 assert.equal(occupied.length,1)
 assert.deepEqual(Object.keys(occupied[0]),['hora'])
 assert.equal((await asRole('anon',null,'select * from public.turnia_ocupados($1,$2::date)',[b,'2099-05-01'])).rows.length,0)
 await change(a,first.id,'cancelado')
 await change(a,second.id,'confirmado')
})
test('server rejects past dates, nonexistent slots, malformed data and invalid state', async () => {
 await assert.rejects(request(serviceA,{date:'2000-01-01'}),/pasado/)
 await assert.rejects(request(serviceA,{time:'10:15'}),/Horario inválido/)
 await assert.rejects(request(serviceA,{phone:'abcdef'}),/Teléfono inválido/)
 await assert.rejects(request(serviceA,{name:' '}),/Nombre inválido/)
 const t=(await request()).rows[0].receipt
 await assert.rejects(change(a,t.id,'otro'),/Estado inválido/)
})
test('database unique index protects against duplicate confirmed slots outside the RPC', async () => {
 const t=(await request()).rows[0].receipt
 await change(a,t.id,'confirmado')
 const other=(await request(serviceA,{time:'11:00'})).rows[0].receipt
 await assert.rejects(db.query("update public.turnos set hora='10:00',estado='confirmado' where id=$1",[other.id]),/unique constraint/)
})
test('registration trigger creates a profile and three services, without trusting a role claim', async () => {
 const id='33333333-3333-4333-8333-333333333333'
 await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{business_name:'Local C',role:'admin'}])
 assert.equal((await db.query('select count(*)::int as n from public.servicios where barbero_id=$1',[id])).rows[0].n,3)
 assert.equal((await asRole('authenticated',id,'select * from public.turnos')).rows.length,0)
})
test('fresh installation works and unknown permissive policies abort safely', async () => {
 const fresh=new PGlite()
 try {
  await fresh.exec(bootstrap)
  await fresh.exec(migration)
  await fresh.exec('create policy unknown_open on public.turnos for select using(true)')
  await assert.rejects(fresh.exec(migration),/políticas personalizadas/)
  await fresh.exec('rollback')
 } finally { await fresh.close() }
})
