import test from 'node:test'
import assert from 'node:assert/strict'
import { appointmentFormError, isAgendaDate, validAppointmentCustomer } from '../src/domain/appointment-validation.js'
import { businessDate, slotAvailable } from '../src/domain/booking.js'
const now=new Date('2030-06-15T12:00:00Z')
const pros=[{id:'p'}],services=[{id:'s'}]
const form={professionalId:'p',serviceId:'s',date:'2030-06-16',time:'10:00',name:'Cliente',phone:'1112345678',status:'pendiente'}
const check=(changes={},initial=null)=>appointmentFormError({...form,...changes},pros,services,initial,now)
test('valid future appointment permits changes to each supported field',()=>{
 for(const change of [{name:'Otro nombre'},{phone:'+54 11 9999-9999'},{date:'2030-06-17'},{time:'11:00'},{vip:true},{status:'confirmado'}])assert.equal(check(change),'')
})
test('missing or invalid fields produce actionable feedback',()=>{
 for(const [change,expected] of [[{professionalId:''},/profesional/],[{serviceId:''},/servicio/],[{date:'2030-02-30'},/fecha/],[{time:'99:00'},/horario/],[{name:' '},/nombre/],[{phone:'abcdef'},/teléfono/]])assert.match(check(change),expected)
})
test('historical names and phones can be corrected without allowing past rescheduling',()=>{
 const initial={...form,date:'2029-01-01'}
 assert.equal(check({date:initial.date,name:'Nombre corregido'},initial),'')
 assert.match(check({date:'2028-01-01'},initial),/futuras/)
 assert.match(check({date:initial.date,status:'confirmado'},initial),/futuras/)
})
test('dates are strict and Buenos Aires midnight is independent of UTC',()=>{
 assert.equal(isAgendaDate('2030-02-30'),false)
 assert.equal(businessDate(new Date('2030-06-15T02:30:00Z')),'2030-06-14')
 assert.equal(validAppointmentCustomer('Ana','abcdef'),false)
})

test('availability rejects malformed or elapsed dates and includes pending overlaps',()=>{
 assert.equal(slotAvailable([], '2030-02-30', '10:00', 30, now),false)
 assert.equal(slotAvailable([], '2030-06-14', '10:00', 30, now),false)
 assert.equal(slotAvailable([{date:'2030-06-16',time:'10:00',duration:90,status:'pendiente'}],'2030-06-16','11:00',30,now),false)
 assert.equal(slotAvailable([{date:'2030-06-16',time:'10:00',duration:90,status:'cancelado'}],'2030-06-16','11:00',30,now),true)
})
