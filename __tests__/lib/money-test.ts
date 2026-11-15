import { amountInput, currencySymbol, formatMoney, MAX_AMOUNT_MINOR, parseAmount } from '@/lib/money';

describe('parseAmount', () => {
  it.each([
    ['1250', 125000],
    ['1,250', 125000],
    ['1,250.5', 125050],
    ['1,250.50', 125050],
    ['0.01', 1],
    ['.5', 50],
    ['600.', 60000],
    ['  600  ', 60000],
    ['₹600', 60000],
    ['₹ 1,25,000', 12500000],
    ['$12.34', 1234],
    ['1 250', 125000],
  ])('reads %p as %p', (input, minor) => {
    expect(parseAmount(input)).toBe(minor);
  });

  it.each(['', ' ', '0', '0.00', '-5', '-₹5', '1.234', '12a', 'abc', '1.2.3', '.', '₹', '1e5', 'Infinity'])('rejects %p', (input) => {
    expect(parseAmount(input)).toBeNull();
  });

  it('rejects amounts over the limit', () => {
    expect(parseAmount('1000000000')).toBe(MAX_AMOUNT_MINOR);
    expect(parseAmount('1000000000.01')).toBeNull();
    expect(parseAmount('99999999999999999999')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('drops paise when there are none', () => {
    expect(formatMoney(125000)).toBe('₹1,250');
    expect(formatMoney(60000, 'INR')).toBe('₹600');
  });

  it('shows paise when there are some', () => {
    expect(formatMoney(125050)).toBe('₹1,250.50');
    expect(formatMoney(1)).toBe('₹0.01');
  });

  it('groups INR the Indian way', () => {
    expect(formatMoney(12500000)).toBe('₹1,25,000');
  });

  it('formats other currencies', () => {
    expect(formatMoney(1234, 'USD')).toMatch(/^\$12\.34$|^US\$12\.34$/);
    expect(formatMoney(0)).toBe('₹0');
  });

  it('keeps the sign', () => {
    expect(formatMoney(-60000)).toBe('-₹600');
  });
});

describe('currencySymbol', () => {
  it('is the symbol for the currency', () => {
    expect(currencySymbol()).toBe('₹');
    expect(currencySymbol('EUR')).toBe('€');
  });
});

describe('amountInput', () => {
  it('turns minor units back into what you would type', () => {
    expect(amountInput(60000)).toBe('600');
    expect(amountInput(125050)).toBe('1250.50');
    expect(amountInput(125005)).toBe('1250.05');
    expect(parseAmount(amountInput(125005))).toBe(125005);
  });
});
