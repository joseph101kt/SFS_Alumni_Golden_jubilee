import {
  calculateEventRegistrationCost,
  getEventCostBreakdown,
  guestMealCounts,
  legacySummaryFromGuests,
  validateRegistrationCost,
} from '../lib/registration.ts';

const jubilee = {
  lunch_paise: 30000,
  dinner_paise: 50000,
  parking_2w_paise: 5000,
  parking_4w_paise: 20000,
  base_ticket_paise: 0,
};

const input = {
  numberOfGuests: 2,
  lunch: true,
  dinner: true,
  parkingNeeded: '4-wheeler',
};

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(calculateEventRegistrationCost(jubilee, input) === 180000, 'two people 180000');
assert(
  calculateEventRegistrationCost(jubilee, { ...input, numberOfGuests: 1 }) === 100000,
  'one person is 100000, not an extra default person'
);
assert(
  calculateEventRegistrationCost({ ...jubilee, base_ticket_paise: 10000 }, input) === 200000,
  'registration fee is per person (2 × ₹100 + meals/parking = 200000)'
);
assert(
  calculateEventRegistrationCost(
    { ...jubilee, base_ticket_paise: 10000 },
    { ...input, numberOfGuests: 1 }
  ) === 110000,
  'one person registration fee is once'
);
assert(
  getEventCostBreakdown({ ...jubilee, base_ticket_paise: 10000 }, input).details.includes(
    'registration fee ₹100 / person'
  ),
  'breakdown names the per-person registration fee'
);
assert(
  getEventCostBreakdown({ ...jubilee, base_ticket_paise: 10000 }, input).baseCost === 20000,
  'baseCost is rate × people'
);
const bd = getEventCostBreakdown(jubilee, input);
assert(bd.totalCost === 180000, 'breakdown total');
assert(bd.baseCost === 0, 'base 0');
assert(validateRegistrationCost(jubilee, input) === true, 'valid');
assert(
  validateRegistrationCost(jubilee, {
    numberOfGuests: 0,
    lunch: false,
    dinner: false,
    parkingNeeded: 'none',
  }) === false,
  'empty invalid'
);
assert(
  validateRegistrationCost({ ...jubilee, base_ticket_paise: 10000 }, {
    numberOfGuests: 0,
    lunch: false,
    dinner: false,
    parkingNeeded: 'none',
  }) === true,
  'base alone valid'
);

const split = {
  ...jubilee,
  lunch_nonveg_paise: 45000,
  dinner_nonveg_paise: 70000,
};
const one = { numberOfGuests: 1, lunch: true, dinner: true, parkingNeeded: '4-wheeler' };
assert(
  calculateEventRegistrationCost(split, { ...one, foodPreference: 'veg' }) === 100000,
  'veg uses the veg meal rates'
);
assert(
  calculateEventRegistrationCost(split, { ...one, foodPreference: 'non-veg' }) === 135000,
  'non-veg uses the higher meal rates'
);
assert(
  calculateEventRegistrationCost(jubilee, { ...one, foodPreference: 'non-veg' }) === 100000,
  'non-veg falls back to veg rates when no separate price is set'
);
assert(
  getEventCostBreakdown(split, { ...one, foodPreference: 'non-veg' }).details.includes('non-veg'),
  'breakdown names the non-veg rate'
);

const parkingOnly = {
  numberOfGuests: 2,
  lunch: false,
  dinner: false,
  parkingNeeded: '4-wheeler',
  foodPreference: 'none',
};
assert(validateRegistrationCost(jubilee, parkingOnly) === true, 'parking alone is valid with no food');
assert(calculateEventRegistrationCost(jubilee, parkingOnly) === 20000, 'no-food parking-only is parking only');
assert(
  getEventCostBreakdown(jubilee, parkingOnly).details.includes('No meals'),
  'no-food breakdown says No meals'
);

const mixedPricing = {
  lunch_paise: 30000,
  dinner_paise: 50000,
  lunch_nonveg_paise: 45000,
  dinner_nonveg_paise: 70000,
  parking_2w_paise: 5000,
  parking_4w_paise: 20000,
  base_ticket_paise: 10000,
};
const mixedGuests = [
  { preference: 'non-veg', lunch: true, dinner: true },
  { preference: 'veg', lunch: true, dinner: false },
  { preference: 'none', lunch: false, dinner: false },
];
assert(
  calculateEventRegistrationCost(mixedPricing, {
    guests: mixedGuests,
    parkingNeeded: '4-wheeler',
  }) === 195000,
  'mixed party totals per guest'
);
const counts = guestMealCounts(mixedGuests);
assert(counts.lunchVeg === 1, 'lunch veg count');
assert(counts.lunchNonVeg === 1, 'lunch non-veg count');
assert(counts.dinnerNonVeg === 1, 'dinner non-veg count');
assert(counts.noFood === 1, 'no-food count');
assert(legacySummaryFromGuests(mixedGuests).food_preference === 'mixed', 'legacy summary mixed');

const zeroDinner = { ...jubilee, dinner_paise: 0, dinner_nonveg_paise: 0 };
assert(
  calculateEventRegistrationCost(zeroDinner, {
    numberOfGuests: 1,
    lunch: true,
    dinner: true,
    parkingNeeded: 'none',
  }) === 30000,
  'zero dinner price is not charged even if dinner is selected'
);
assert(
  !getEventCostBreakdown(zeroDinner, {
    numberOfGuests: 1,
    lunch: true,
    dinner: true,
    parkingNeeded: 'none',
  }).details.toLowerCase().includes('dinner'),
  'breakdown omits zero-priced dinner'
);

const ranged = {
  ...jubilee,
  base_ticket_paise: 5000,
  fee_batch_from: 1986,
  fee_batch_to: 2000,
  fee_batch_paise: 10000,
};
assert(
  calculateEventRegistrationCost(ranged, { ...input, numberOfGuests: 1, batch: 1990 }) === 110000,
  'batch in range pays range fee ₹100'
);
assert(
  calculateEventRegistrationCost(ranged, { ...input, numberOfGuests: 1, batch: 2010 }) === 105000,
  'batch outside range pays default fee ₹50'
);
const rangedZero = { ...ranged, fee_batch_paise: 0, base_ticket_paise: 10000 };
assert(
  calculateEventRegistrationCost(rangedZero, { ...input, numberOfGuests: 1, batch: 1990 }) === 100000,
  'in-range fee may be ₹0'
);
assert(
  calculateEventRegistrationCost(rangedZero, { ...input, numberOfGuests: 1, batch: 2010 }) === 110000,
  'outside range still pays default when range fee is 0'
);

const freeRangeNoMeals = {
  lunch_paise: 0,
  dinner_paise: 0,
  parking_2w_paise: 0,
  parking_4w_paise: 0,
  base_ticket_paise: 0,
  fee_batch_from: 1986,
  fee_batch_to: 2000,
  fee_batch_paise: 0,
};
assert(
  validateRegistrationCost(freeRangeNoMeals, {
    numberOfGuests: 1,
    lunch: false,
    dinner: false,
    parkingNeeded: 'none',
    batch: 1990,
  }) === true,
  '₹0 meals + ₹0 range fee still allows registration'
);
assert(
  validateRegistrationCost(
    { ...freeRangeNoMeals, lunch_paise: 30000, fee_batch_paise: 5000 },
    { numberOfGuests: 1, lunch: false, dinner: false, parkingNeeded: 'none', batch: 1990 }
  ) === true,
  'range fee alone (no meals selected) is valid'
);
assert(
  validateRegistrationCost(
    { ...jubilee, base_ticket_paise: 0 },
    { numberOfGuests: 1, lunch: false, dinner: false, parkingNeeded: 'none', batch: 1990 }
  ) === false,
  'priced meals on offer still require a choice when fee is 0'
);

console.log('PASS event registration cost');
