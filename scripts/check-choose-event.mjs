import { chooseRegistrationEvent, registrationPath, safeRegistrationNext } from '../lib/events/choose-event.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const only = [{ id: 'a' }];
const many = [{ id: 'a' }, { id: 'b' }];
assert(chooseRegistrationEvent(only)?.id === 'a', 'one event opens directly');
assert(chooseRegistrationEvent(many) === null, 'several events are not auto-selected');
assert(chooseRegistrationEvent([]) === null, 'no events');
assert(registrationPath('a b') === '/registration?event=a%20b', 'event id is in the link');
assert(safeRegistrationNext('/registration?event=abc') === '/registration?event=abc', 'registration return is kept');
assert(safeRegistrationNext('/event-app') === '/event-app', 'event app return is kept');
assert(safeRegistrationNext('/event-app/pass') === '/event-app/pass', 'venue pass return is kept');
assert(safeRegistrationNext('https://evil.example') === null, 'external return is dropped');
assert(safeRegistrationNext('//evil.example') === null, 'protocol-relative return is dropped');
assert(safeRegistrationNext('/admin') === null, 'admin return is dropped');
assert(safeRegistrationNext('/admin-app') === '/admin-app', 'admin-app return is kept');
assert(
  safeRegistrationNext('/admin-app/event-ops') === '/admin-app/event-ops',
  'admin-app subpath kept'
);

console.log('PASS choose event');
