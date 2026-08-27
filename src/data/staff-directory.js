export const STAFF_MEMBERS = [
  { name: 'Michael Pundo', phone: '0721793701' },
  { name: 'Kevin Kimani', phone: '0725296014' },
  { name: 'Monica Consolata', phone: '0707301064' },
  { name: 'Ruth Wangui', phone: '0714304628' },
  { name: 'Faith Mwende', phone: '0745058411' },
  { name: 'Ivy Anyango', phone: '0712404447' },
  { name: 'Eunice Wambua', phone: '0714411350' },
  { name: 'Doris Mogaka', phone: '0728967378' },
  { name: 'Diana Rubia', phone: '0729459754' },
  { name: 'Elijah Ochieng', phone: '0726467752' },
  { name: 'Samuel Muli', phone: '0722139672' },
  { name: 'Lucy Karaya', phone: '0708767733' },
  { name: 'Diana Atieno', phone: '0710476156' },
  { name: 'Josiah Omondi', phone: '0701014681' },
  { name: 'Eunice Wairimu', phone: '0721767919' },
  { name: 'Kevin Apala', phone: '0712766788' },
  { name: 'Kennedy Odongo', phone: '0725751501' },
  { name: 'Alex Evoge', phone: '0791665690' },
  { name: 'Mercy Milanoi', phone: '0703797871' },
  { name: 'Linda Namunyak', phone: '0707439087' },
  { name: 'Edwin Kipkore', phone: '0729228780' },
  { name: 'Anthony Kimote', phone: '0713683983' },
  { name: 'Caleb Ochieng', phone: '0701396085' },
  { name: 'John Simiyu', phone: '0700560904' },
  { name: 'Anthony Simbi', phone: '0790610856' },
  { name: 'Samuel Amuko', phone: '0795322201' },
  { name: 'Oscar Odongo', phone: '0724943495' },
  { name: 'Grace Njeri', phone: '0721725906' },
  { name: 'Victor Anyula', phone: '0769855115' },
  { name: 'Josephine Kerubo', phone: '0711942421' },
  { name: 'Felix Machio', phone: '0707226913' },
  { name: 'Elizabeth Sijenyi', phone: '0721862451' },
  { name: 'Zila Mwalimo', phone: '0721740306' },
  { name: 'Charles Rioba', phone: '0753054418' },
  { name: 'Peter Maina', phone: '0700115646' },
  { name: 'Doreen Etambo', phone: '0726383554' },
  { name: 'Christopher Odongo', phone: '0774734636' },
  { name: 'Agnes Eshunwa', phone: '0717053896' },
  { name: 'LUMUMBA LAKEN KAVUTHA', phone: '0705631782' },
  { name: 'MWANGANGI LEWIS ORIKI', phone: '0706016866' },
  { name: 'KETUYO ESTHER NADENYA', phone: '0745141598' },
  { name: 'WANGETHI REBECCA WAMBUI', phone: '0706840540' },
  { name: 'KINYUA EVANS KIMANZI', phone: '0717847049' },
  { name: 'ONKUNDI HEDWIG MACHARIA', phone: '0797656579' },
  { name: 'TIMAIYO GLORIA NASIEKU', phone: '0748163168' },
  { name: 'RASHID MERI NGOME', phone: '0790708407' },
  { name: 'KATAH NICHOLAS KIPLAGAT', phone: '0714008441' },
  { name: 'Georgina Njoroge', phone: '0727430305' },
  { name: 'Sherryl Ayuma', phone: '0707032882' },
  { name: 'Linda Makokha', phone: '0114042413' },
  { name: 'Christine Wekesa', phone: '0119151425' },
  { name: 'Sandra Mideva', phone: '0757783534' },
  { name: 'Ann Wangechi', phone: '0790667661' },
  { name: 'Stacy Amondi', phone: '0712130203' },
  { name: 'Clemente Reis', phone: '0723494742' },
  { name: 'Kester Muiruri', phone: '0710664142' },
  { name: 'Hadrine Joyce', phone: '0740126095' },
  { name: 'Martin Rachier', phone: '0115122948' },
  { name: 'Lucas Odero', phone: '0758380884' },
  { name: 'Sylvia wafula', phone: '0111783166' },
  { name: 'Brenda Wekesa', phone: '0796697371' },
  { name: 'Sharon Onyango', phone: '0704552961' },
  { name: 'Asha Washe', phone: '0722665943' },
  { name: 'Ann Mithanga', phone: '0792088812' },
  { name: 'Judith Nandacha', phone: '0727993709' },
  { name: 'Wycliffe Otieno', phone: '0759230579' },
  { name: 'Tamia Wairimu', phone: '0708579470' },
  { name: 'Mohammed', phone: '0703524621' },
  { name: 'Maxim Simiyu', phone: '0721906744' }
];

export function normalizePhoneNumber(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length >= 9) {
    return digits.slice(-9); // Extract last 9 digits for uniform matching
  }
  return digits;
}

export function isStaffPhoneNumber(phone) {
  const norm = normalizePhoneNumber(phone);
  if (!norm || norm.length < 9) return null;
  return STAFF_MEMBERS.find(s => normalizePhoneNumber(s.phone) === norm) || null;
}
