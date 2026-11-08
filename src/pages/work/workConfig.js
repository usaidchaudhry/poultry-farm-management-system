const text = (name, label, required = false) => ({ name, label, type: 'text', required });
const num = (name, label, required = false) => ({ name, label, type: 'number', required });
const date = (name, label, required = false) => ({ name, label, type: 'date', required });
const notes = (name, label) => ({ name, label, type: 'textarea' });
const farm = { name: 'farmId', label: 'Farm', type: 'farm', required: true };
const house = { name: 'houseId', label: 'House', type: 'house' };
const flock = { name: 'flockId', label: 'Flock', type: 'flock', required: true };
const eggs = ['Jumbo', 'Starter', 'Standard', 'Small', 'Floor', 'Broken', 'Discard'].map((label) => num(`eggs.${label.toLowerCase()}`, `${label} eggs`));

export const WORK_CONFIG = {
  dailyReports: { title: 'Daily reports', singular: 'daily report', dateKey: 'date', summary: ['date', 'farmId', 'flockId', 'status', 'totalEggs', 'mortality'], sections: [
    { title: 'Working area', fields: [farm, house, flock, date('date', 'Business date', true)] },
    { title: 'Egg collection', fields: eggs },
    { title: 'Bird population and mortality', fields: [num('openingBirds', 'Opening birds'), num('birdsPlaced', 'Birds placed'), num('transfersIn', 'Transfers in'), num('transfersOut', 'Transfers out'), num('mortality', 'Mortality count'), notes('postMortem', 'Post-mortem observations')] },
    { title: 'Feed, water, and light', fields: [num('feedBags', 'Feed bags used'), num('bagSize', 'Bag size (kg)'), num('feedPerBird', 'Feed per bird (g)'), num('waterLitres', 'Water used (litres)'), num('lightHours', 'Light hours'), notes('extraFeed', 'Extra feed material')] },
    { title: 'Health and operations', fields: [notes('medicine', 'Medicine recorded'), notes('vaccine', 'Vaccine recorded'), notes('issues', 'Operational issues'), notes('doctorRemarks', 'Doctor visit remarks'), num('sampleSize', 'Weight sample size'), num('averageWeight', 'Average weight (g)')] },
  ] },
  clinicalVisits: { title: 'Clinical visits', singular: 'clinical visit', dateKey: 'date', summary: ['date', 'farmId', 'flockId', 'diagnosis', 'status'], sections: [
    { title: 'Visit', fields: [farm, house, flock, date('date', 'Visit date', true), text('diagnosis', 'Diagnosis', true), notes('observations', 'Observations'), notes('parameters', 'Bird parameters'), notes('remarks', 'Remarks')] },
    { title: 'Prescription', fields: [text('medicine', 'Medicine'), text('dose', 'Dose'), text('route', 'Route (water, feed, or other)'), text('frequency', 'Frequency'), num('duration', 'Duration (days)'), date('dueAt', 'First due date'), notes('instructions', 'Instructions')] },
  ] },
  inventoryItems: { title: 'Inventory and feed', singular: 'inventory item', summary: ['name', 'category', 'unit', 'balance', 'minimum'], sections: [{ title: 'Item', fields: [text('name', 'Name', true), text('category', 'Category', true), text('unit', 'Unit', true), num('balance', 'Opening balance', true), num('minimum', 'Minimum stock')] }] },
  stockMovements: { title: 'Stock movements', singular: 'stock movement', dateKey: 'date', summary: ['date', 'itemId', 'type', 'quantity', 'createdBy'], sections: [{ title: 'Movement', fields: [date('date', 'Date', true), { name: 'itemId', label: 'Item', type: 'item', required: true }, { name: 'type', label: 'Type', type: 'select', required: true, options: ['receipt', 'issue', 'adjustment', 'transfer'].map((value) => ({ value, label: value })) }, num('quantity', 'Quantity (adjustment may be negative)', true), { name: 'fromFarmId', label: 'From farm (transfer)', type: 'farm' }, { name: 'toFarmId', label: 'To farm (transfer)', type: 'farm' }, notes('reason', 'Reason')] }] },
  eggProduction: { title: 'Egg production', singular: 'production entry', dateKey: 'date', summary: ['date', 'farmId', 'totalEggs', 'saleableEggs'], sections: [{ title: 'Production', fields: [farm, date('date', 'Date', true), ...eggs, num('damaged', 'Damaged eggs'), num('rejected', 'Rejected eggs')] }] },
  sales: { title: 'Sales', singular: 'sale', dateKey: 'date', summary: ['date', 'farmId', 'buyer', 'quantity', 'unit', 'total', 'paymentStatus'], sections: [{ title: 'Sale', fields: [farm, date('date', 'Date', true), text('buyer', 'Buyer', true), num('quantity', 'Quantity', true), { name: 'unit', label: 'Unit', type: 'select', required: true, options: [{ value: 'eggs', label: 'Eggs' }, { value: 'Peti', label: 'Peti (360 eggs)' }] }, num('unitPrice', 'Unit price (PKR)', true), { name: 'paymentStatus', label: 'Payment status', type: 'select', options: [{ value: 'pending', label: 'Pending' }, { value: 'paid', label: 'Paid' }] }] }] },
  expenses: { title: 'Finance', singular: 'expense', dateKey: 'date', summary: ['date', 'farmId', 'category', 'amount', 'description'], sections: [{ title: 'Expense', fields: [farm, date('date', 'Date', true), { name: 'category', label: 'Category', type: 'select', required: true, options: ['Feed', 'Medicine and vaccine', 'Labour', 'Electricity', 'Other'].map((value) => ({ value, label: value })) }, num('amount', 'Amount (PKR)', true), text('description', 'Description')] }] },
  measurements: { title: 'Bird parameters', singular: 'measurement', dateKey: 'date', summary: ['date', 'flockId', 'sampleSize', 'averageWeight', 'unit'], sections: [{ title: 'Weight sample', fields: [farm, house, flock, date('date', 'Sample date', true), num('sampleSize', 'Sample size', true), num('averageWeight', 'Average weight', true), { name: 'unit', label: 'Unit', type: 'select', options: [{ value: 'g', label: 'Grams' }, { value: 'kg', label: 'Kilograms' }] }, notes('notes', 'Notes')] }] },
};
