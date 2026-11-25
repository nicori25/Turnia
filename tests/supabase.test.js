import test,{before,beforeEach,after} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist'
const migration=await readFile(new URL('../supabase/migrations/20261119_organizaciones_profesionales.sql',import.meta.url),'utf8')
const onboarding=await readFile(new URL('../supabase/migrations/20261125_alta_barbero.sql',import.meta.url),'utf8')
const crud=await readFile(new URL('../supabase/migrations/20261125_crud_turnos.sql',import.meta.url),'utf8')
const fixture=await readFile(new URL('./fixtures/organizaciones.sql',import.meta.url),'utf8')
const uuid=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const orgA=uuid(1),orgB=uuid(2),adminA=uuid(3),userA=uuid(4),adminB=uuid(5),userB=uuid(6)
const proA=uuid(7),proB=uuid(8),proC=uuid(9),serviceA=uuid(10),serviceB=uuid(11),longService=uuid(12),privateService=uuid(13)
let db,policies,tokenId=100
async function role(name,user,sql,params=[]){
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user??''])
 await db.exec(`set role ${name}`)
 try{return await db.query(sql,params)}finally{await db.exec('reset role')}
}
const token=()=>uuid(tokenId++)
async function request(options={}){
 const r=await role('anon',null,'select turnia_v2_solicitar($1,$2,$3::date,$4::time,$5,$6,$7,$8) as receipt',
 [options.pro??proA,options.service??serviceA,options.date??'2099-05-01',options.time??'10:00',options.name??'Cliente de prueba',options.phone??'1112345678',options.vip??false,options.token??token()])
 return r.rows[0].receipt
}
const change=(user,id,status)=>role('authenticated',user,'select turnia_v2_estado($1,$2)',[id,status])
const agenda=async(user,date='2099-05-01')=>(await role('authenticated',user,'select * from turnia_v2_agenda($1::date,null)',[date])).rows
before(async()=>{
 db=new PGlite({extensions:{btree_gist}})
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`)
 await db.exec(fixture)
 for(const user of [adminA,userA,adminB,userB])await db.query('insert into auth.users values($1)',[user])
 await db.query("insert into organizaciones(id,nombre,slug) values($1,'Local A','a'),($2,'Local B','b')",[orgA,orgB])
 for(const [user,org,name,rol] of [[adminA,orgA,'Admin A','admin'],[userA,orgA,'Profesional A','profesional'],[adminB,orgB,'Admin B','admin'],[userB,orgA,'Profesional B','profesional']])
  await db.query('insert into perfiles(id,organizacion_id,nombre,rol)values($1,$2,$3,$4)',[user,org,name,rol])
 await db.query("insert into profesionales(id,organizacion_id,perfil_id,nombre)values($1,$2,$3,'Pro A'),($4,$2,$5,'Pro B'),($6,$7,null,'Pro C')",[proA,orgA,userA,proB,userB,proC,orgB])
 for(const [id,org,pro,name,duration,price] of [[serviceA,orgA,null,'Corte',30,4500],[serviceB,orgB,null,'Corte B',30,5000],[longService,orgA,null,'Servicio largo',90,7000],[privateService,orgA,proA,'Solo A',30,3000]])
  await db.query('insert into servicios(id,organizacion_id,profesional_id,nombre,duracion_min,precio)values($1,$2,$3,$4,$5,$6)',[id,org,pro,name,duration,price])
 policies=(await db.query('select * from pg_policies order by policyname')).rows
 await db.exec(migration);await db.exec(migration);await db.exec(onboarding);await db.exec(onboarding);await db.exec(crud);await db.exec(crud)
})
beforeEach(async()=>{await db.exec('delete from turnos;delete from clientes')})
after(async()=>db.close())

test('migration is repeatable and leaves existing policies and records intact',async()=>{
 assert.deepEqual((await db.query('select * from pg_policies order by policyname')).rows,policies)
 assert.equal((await db.query("select count(*)::int n from servicios")).rows[0].n,4)
 assert.equal((await db.query("select count(*)::int n from pg_tables where schemaname='public' and tablename='barberos'")).rows[0].n,0)
})
test('public directory and catalog select active professionals and compatible services',async()=>{
 const rows=(await role('anon',null,'select * from turnia_v2_locales()')).rows
 assert.equal(rows.length,3);assert.deepEqual(Object.keys(rows[0]).sort(),['business_name','id'])
 const services=(await role('anon',null,'select * from turnia_v2_servicios($1)',[proB])).rows
 assert(!services.some(s=>s.id===privateService));assert(services.some(s=>s.id===serviceA))
 await assert.rejects(request({pro:proB,service:privateService}),/Servicio no disponible/)
 await assert.rejects(request({pro:proA,service:serviceB}),/Servicio no disponible/)
})
test('request snapshots price and duration, links a client, retries without duplication',async()=>{
 const key=token();const a=await request({vip:true,token:key}),b=await request({vip:true,token:key})
 assert.equal(a.id,b.id);assert.equal(a.precio_total,6000)
 const t=(await db.query('select * from turnos')).rows[0]
 assert.equal(t.servicio_nombre,'Corte');assert.equal(t.duracion_min,30);assert(t.cliente_id)
 assert.equal((await db.query('select count(*)::int n from clientes')).rows[0].n,1)
 await assert.rejects(request({token:key,name:'Otra persona'}),/ya utilizado/)
})
test('pending and confirmed appointments block overlapping durations, not another professional',async()=>{
 const t=await request({service:longService})
 await assert.rejects(request({time:'11:00'}),/ocupado/)
 const occupied=(await role('anon',null,'select * from turnia_v2_ocupados($1,$2::date,$3)',[proA,'2099-05-01',serviceA])).rows
 assert.deepEqual(occupied.map(r=>r.hora),['10:00:00','11:00:00']);assert.deepEqual(Object.keys(occupied[0]),['hora'])
 await request({pro:proB,time:'11:00'})
 await change(userA,t.id,'confirmado')
 await assert.rejects(request(),/ocupado/)
 await change(adminA,t.id,'cancelado');await request()
})
test('admin sees the organization and professionals only their own appointments',async()=>{
 const t=await request();await request({pro:proB});await request({pro:proC,service:serviceB})
 assert.equal((await agenda(adminA)).length,2)
 assert.deepEqual((await agenda(userA)).map(t=>t.id),[t.id])
 assert.equal((await agenda(adminB)).length,1)
 await assert.rejects(change(userB,t.id,'confirmado'),/sin permiso/)
 await assert.rejects(change(adminB,t.id,'cancelado'),/sin permiso/)
 await change(userA,t.id,'confirmado');await change(adminA,t.id,'cancelado')
})
test('anonymous users cannot inspect clients or change appointment states',async()=>{
 const t=await request()
 assert.equal((await role('anon',null,'select * from turnos')).rows.length,0)
 await assert.rejects(role('anon',null,'select * from turnia_v2_agenda($1::date,null)',['2099-05-01']),/permission denied/)
 await assert.rejects(role('anon',null,'select turnia_v2_estado($1,$2)',[t.id,'confirmado']),/permission denied/)
})
test('server rejects past dates, invalid input, arbitrary slots and unaffiliated users',async()=>{
 await assert.rejects(request({date:'2000-01-01'}),/pasado/)
 await assert.rejects(request({time:'10:15'}),/Horario inválido/)
 await assert.rejects(request({phone:'abcdef'}),/Teléfono inválido/)
 await assert.rejects(request({name:' '}),/Nombre inválido/)
 const t=await request()
 await assert.rejects(change(adminA,t.id,'otro'),/Estado inválido/)
 await assert.rejects(role('authenticated',uuid(99),'select * from turnia_v2_agenda($1::date,null)',['2099-05-01']),/perfil asignado/)
})
test('existing exclusion constraint prevents overlap outside the public RPC',async()=>{
 await request({service:longService})
 const other=await request({time:'12:30'})
 await assert.rejects(db.query("update turnos set hora='11:00' where id=$1",[other.id]),/exclusion constraint/)
})

const prepare=(user)=>role('authenticated',user,'select turnia_v2_preparar_cuenta() as setup')
test('new barber onboarding creates its own organization, linked active professional and catalog once',async()=>{
 const id=uuid(501)
 await db.query('insert into auth.users(id,raw_user_meta_data)values($1,$2)',[id,{business_name:'Local nuevo',rol:'admin',organizacion_id:orgA}])
 const first=(await prepare(id)).rows[0].setup,again=(await prepare(id)).rows[0].setup
 assert.deepEqual(first,again);assert.notEqual(first.organizacion_id,orgA);assert.equal(first.activo,true)
 const profile=(await db.query('select * from perfiles where id=$1',[id])).rows[0]
 assert.equal(profile.rol,'admin');assert.equal(profile.organizacion_id,first.organizacion_id)
 const pro=(await db.query('select * from profesionales where id=$1',[first.profesional_id])).rows[0]
 assert.equal(pro.perfil_id,id)
 assert.equal((await db.query('select count(*)::int n from servicios where profesional_id=$1',[pro.id])).rows[0].n,3)
 const directory=(await role('anon',null,'select * from turnia_v2_locales()')).rows
 assert(directory.some(p=>p.id===pro.id))
})
test('onboarding preserves an existing professional and does not reactivate disabled staff',async()=>{
 const before=(await db.query('select count(*)::int n from servicios')).rows[0].n
 await db.query('update profesionales set activo=false where id=$1',[proA])
 const setup=(await prepare(userA)).rows[0].setup
 assert.equal(setup.organizacion_id,orgA);assert.equal(setup.profesional_id,proA);assert.equal(setup.activo,false)
 assert.equal((await db.query('select count(*)::int n from servicios')).rows[0].n,before)
 await db.query('update profesionales set activo=true where id=$1',[proA])
})
test('unlinked employee cannot self-assign a new professional in an existing organization',async()=>{
 const id=uuid(502)
 await db.query('insert into auth.users(id)values($1)',[id])
 await db.query("insert into perfiles(id,organizacion_id,nombre,rol)values($1,$2,'Empleado','profesional')",[id,orgA])
 await assert.rejects(prepare(id),/todavía no está vinculada/)
 assert.equal((await db.query('select count(*)::int n from profesionales where perfil_id=$1',[id])).rows[0].n,0)
})
test('onboarding requires an authenticated user and valid business name',async()=>{
 await assert.rejects(role('anon',null,'select turnia_v2_preparar_cuenta()'),/permission denied/)
 const id=uuid(503)
 await db.query('insert into auth.users(id)values($1)',[id])
 await assert.rejects(prepare(id),/nombre del local/)
 assert.equal((await db.query('select count(*)::int n from perfiles where id=$1',[id])).rows[0].n,0)
})

async function save(user,options={}){
 const r=await role('authenticated',user,'select turnia_v2_guardar_turno($1,$2,$3,$4::date,$5::time,$6,$7,$8,$9,$10) as receipt',
 [options.id??null,options.pro??proA,options.service??serviceA,options.date??'2099-05-01',options.time??'10:00',options.name??'Cliente editado',options.phone??'1112345678',options.vip??false,options.status??'pendiente',options.token??token()])
 return r.rows[0].receipt
}
const remove=(user,id)=>role('authenticated',user,'select turnia_v2_eliminar_turno($1)',[id])
test('CRUD form options only expose authorized professionals and compatible services',async()=>{
 const own=(await role('authenticated',userA,'select turnia_v2_opciones_turno() as options')).rows[0].options
 assert.deepEqual(own.profesionales.map(p=>p.id),[proA])
 assert(!own.servicios.some(s=>s.id===serviceB))
 const admin=(await role('authenticated',adminA,'select turnia_v2_opciones_turno() as options')).rows[0].options
 assert(admin.profesionales.some(p=>p.id===proA));assert(admin.profesionales.some(p=>p.id===proB));assert(!admin.profesionales.some(p=>p.id===proC))
 await assert.rejects(role('anon',null,'select turnia_v2_opciones_turno()'),/permission denied/)
})
test('CRUD creates once, edits all fields and preserves appointment identity',async()=>{
 const key=token(),created=await save(adminA,{token:key,status:'confirmado'})
 assert.equal((await save(adminA,{token:key,status:'confirmado'})).id,created.id)
 assert.equal((await db.query('select count(*)::int n from turnos')).rows[0].n,1)
 await save(adminA,{id:created.id,pro:proB,service:longService,date:'2099-05-02',time:'16:00',name:'Nombre nuevo',phone:'1198765432',vip:true,status:'pendiente'})
 const record=(await db.query('select * from turnos where id=$1',[created.id])).rows[0]
 assert.equal(record.profesional_id,proB);assert.equal(record.servicio_id,longService);assert.equal(record.duracion_min,90)
 assert.equal(record.precio_total,'8500');assert.equal(record.cliente_nombre,'Nombre nuevo');assert.equal(record.cliente_telefono,'1198765432')
 assert.equal(record.estado,'pendiente');assert.equal(record.fecha.toISOString().slice(0,10),'2099-05-02')
})
test('CRUD rejects editing or deleting other organizations and other professionals',async()=>{
 const record=await save(userA)
 await assert.rejects(save(adminB,{id:record.id,pro:proC,service:serviceB}),/sin permiso/)
 await assert.rejects(save(userB,{id:record.id,pro:proB}),/sin permiso/)
 await assert.rejects(save(userA,{id:record.id,pro:proB}),/fuera de tu acceso/)
 await assert.rejects(remove(adminB,record.id),/sin permiso/)
 await assert.rejects(remove(userB,record.id),/sin permiso/)
 assert.equal((await db.query('select profesional_id from turnos where id=$1',[record.id])).rows[0].profesional_id,proA)
})
test('CRUD detects rescheduling conflicts without altering the original record',async()=>{
 await request({service:longService})
 const record=await save(userA,{time:'12:30'})
 await assert.rejects(save(userA,{id:record.id,time:'11:00'}),/ocupado/)
 assert.equal((await db.query('select hora from turnos where id=$1',[record.id])).rows[0].hora,'12:30:00')
})
test('CRUD physical deletion releases the slot and preserves the client record',async()=>{
 const record=await save(userA,{status:'confirmado'})
 await remove(userA,record.id)
 assert.equal((await db.query('select count(*)::int n from turnos')).rows[0].n,0)
 assert.equal((await db.query('select count(*)::int n from clientes')).rows[0].n,1)
 await request()
})
test('CRUD rejects past creation, invalid data and anonymous writes',async()=>{
 await assert.rejects(save(adminA,{date:'2000-01-01'}),/pasado/)
 await assert.rejects(save(adminA,{phone:'abcdef'}),/Teléfono inválido/)
 await assert.rejects(save(adminA,{status:'desconocido'}),/Estado inválido/)
 await assert.rejects(role('anon',null,'select turnia_v2_eliminar_turno($1)',[token()]),/permission denied/)
})
