import { EntryInput } from './api';

export const parseBot = (v: string) => {
  v = v.trim();
  const hasStar = v.endsWith('*');
  const hasPlus = v.endsWith('+');
  const stripped = (hasStar || hasPlus) ? v.slice(0, -1) : v;
  return {
    numPart: stripped === '' ? 0 : (parseInt(stripped) || 0),
    hasStar,
    hasPlus
  };
};

export const getPerms = (n: string) => {
  if (!n) return [];
  if (n.length < 3) return [n];
  if (n[0] === n[1] && n[1] === n[2]) return [n];
  const set = new Set<string>();
  const a = n.split('');
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (j !== i) {
        for (let k = 0; k < 3; k++) {
          if (k !== i && k !== j) set.add(a[i] + a[j] + a[k]);
        }
      }
    }
  }
  return Array.from(set);
};

export const generateEntries = (number: string, topAmt: string, botAmt: string): EntryInput[] => {
  if (!number) return [];
  
  const newEntries: EntryInput[] = [];
  const topAmtParsed = parseInt(topAmt) || 0;
  const p = parseBot(botAmt);
  let ba = p.numPart;

  if (number.length === 2) {
    const add2 = (n: string) => {
      if (topAmtParsed > 0) newEntries.push({ number: n, type: '2บน', amount: topAmtParsed });
      if (ba > 0) newEntries.push({ number: n, type: '2ล่าง', amount: ba });
    };

    if (p.hasStar) {
      ba = ba || topAmtParsed;
      add2(number);
      const rev = number[1] + number[0];
      if (rev !== number) add2(rev);
    } else {
      add2(number);
    }
  } else if (number.length === 3) {
    const perms = getPerms(number);
    if (p.hasPlus) {
      const alt = p.numPart;
      if (topAmtParsed > 0) {
        if (alt === 0) {
          perms.forEach(x => newEntries.push({ number: x, type: '3บน', amount: topAmtParsed }));
        } else {
          newEntries.push({ number: number, type: '3บน', amount: topAmtParsed });
          perms.filter(x => x !== number).forEach(x => newEntries.push({ number: x, type: '3บน', amount: alt }));
        }
      }
    } else {
      const tod = p.numPart;
      if (topAmtParsed > 0) newEntries.push({ number, type: '3บน', amount: topAmtParsed });
      if (tod > 0) newEntries.push({ number, type: '3โต้ด', amount: tod });
    }
  }
  
  return newEntries;
};

export const checkLimit = (
  number: string, 
  type: string, 
  amount: number, 
  keeps: Record<string, string>, 
  specificLimits: { num: string, [key: string]: string }[]
): boolean => {
  let limit = parseFloat(keeps[type] || '0');
  
  let searchNums = [number];
  if (type === '3โต้ด') {
    searchNums = getPerms(number);
  }

  const sp = specificLimits.find(x => searchNums.includes(x.num));
  if (sp && sp[type] && sp[type].trim() !== '') {
    limit = parseFloat(sp[type]);
  }
  return amount > limit;
};

export const isWinning = (
  entry: { number: string, type: string },
  results: { [key: string]: string }
): boolean => {
  if (!entry || !results) return false;
  const { number, type } = entry;
  if (!number || !type) return false;
  
  if (type === '2บน') return !!results['2บน'] && number === results['2บน'];
  if (type === '2ล่าง') return !!results['2ล่าง'] && number === results['2ล่าง'];
  if (type === '3บน') return !!results['3บน'] && number === results['3บน'];
  if (type === '3โต้ด') {
    if (!results['3โต้ด']) return false;
    const resPerms = getPerms(results['3โต้ด']);
    return resPerms.includes(number); // If the played number is one of the permutations of the winning 3โต้ด
  }
  return false;
};

export const getPrizeRate = (
  entry: { number: string, type: string },
  rates: { [key: string]: string },
  specificRates: { num: string, [key: string]: string }[]
): number => {
  const { number, type } = entry;
  let rate = parseFloat(rates[type] || '0');
  
  let searchNums = [number];
  if (type === '3โต้ด') searchNums = getPerms(number);

  const sp = (specificRates || []).find(x => searchNums.includes(x.num));
  if (sp && sp[type] && sp[type].trim() !== '') {
    rate = parseFloat(sp[type]);
  }
  
  return rate;
};

export const getLimit = (
  number: string, 
  type: string, 
  keeps: Record<string, string>, 
  specificLimits: { num: string, [key: string]: string }[]
): number => {
  let limit = parseFloat(keeps[type] || '999999999');
  
  let searchNums = [number];
  if (type === '3โต้ด') searchNums = getPerms(number);

  const sp = (specificLimits || []).find(x => searchNums.includes(x.num));
  if (sp && sp[type] && sp[type].trim() !== '') {
    limit = parseFloat(sp[type]);
  }
  return limit;
};
