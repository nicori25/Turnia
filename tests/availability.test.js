import test from 'node:test'
import assert from 'node:assert/strict'
import { businessDate, isBookableDate, isFutureSlot, isValidDate, formatDate } from '../src/utils/dates.js'
import { availability, clearAvailability, isSlotAvailable } from '../src/store/turnos.js'
import { validPhone } from '../src/store/booking.js'
import { normalizeAppointment, publicError } from '../src/services/turnia.js'
const now=new Date('2030-06-15T12:00:00Z')
test('business date uses Buenos Aires across UTC midnight',()=>{
 assert.equal(businessDate(new Date('2030-06-15T02:30:00Z')),'2030-06-14')
 assert.equal(formatDate('2030-06-15'),'15/06/2030')
})
test('rejects invalid and past dates and already elapsed times',()=>{
 for(const d of ['',null,'2030-02-30','2030-13-01'])assert.equal(isValidDate(d),false)
 assert.equal(isBookableDate('2030-06-14',now),false)
 assert.equal(isBookableDate('2030-06-16',now),true)
 assert.equal(isFutureSlot('2030-06-15','09:00',now),false)
 assert.equal(isFutureSlot('2030-06-15','10:00',now),true)
})
test('availability fails closed and only trusts matching confirmed-slot responses',()=>{
 clearAvailability()
 assert.equal(isSlotAvailable('2030-06-15','10:00',now),false)
 Object.assign(availability,{date:'2030-06-15',ready:true,slots:['10:00']})
 assert.equal(isSlotAvailable('2030-06-15','10:00',now),false)
 assert.equal(isSlotAvailable('2030-06-15','11:00',now),true)
 assert.equal(isSlotAvailable('2030-06-16','11:00',now),false)
 availability.error='Sin conexión'
 assert.equal(isSlotAvailable('2030-06-15','11:00',now),false)
 clearAvailability()
})
test('phone validator rejects letters and accepts formatted numbers',()=>{
 assert.equal(validPhone('abcdef'),false)
 assert.equal(validPhone('+54 (11) 1234-5678'),true)
 assert.equal(validPhone('12345'),false)
})
test('database UUIDs, dates and numeric price are preserved',()=>{
 const t=normalizeAppointment({id:'uuid',barbero_id:'owner',fecha:'2030-06-15',hora:'10:00:00',estado:'pendiente',precio_total:'4500.00',servicios:{nombre:'Corte'}})
 assert.equal(t.id,'uuid');assert.equal(t.time,'10:00');assert.equal(t.price,4500)
 assert.equal(publicError({code:'PGRST202'}),'Falta aplicar la actualización de la base de datos en Supabase.')
})
