import { describe, test, expect } from 'vitest';
import { parseBusinessCSV, type Business } from '../src/csv-parser';

describe('CSV Parser', () => {
  test('parses CSV file and extracts business data', async () => {
    const csvContent = `ID,Name,Address,Website,Phone
1,Test Business,"123 Main St, OK",https://test.com,(555) 123-4567`;

    const businesses = await parseBusinessCSV(csvContent);

    expect(businesses).toHaveLength(1);
    expect(businesses[0].name).toBe('Test Business');
    expect(businesses[0].address).toBe('123 Main St, OK');
    expect(businesses[0].website).toBe('https://test.com');
    expect(businesses[0].phone).toBe('(555) 123-4567');
  });

  test('handles multiple businesses', async () => {
    const csvContent = `ID,Name,Address,Website,Phone
1,Business A,"123 St, OK",https://a.com,(555) 111-1111
2,Business B,"456 Ave, OK",https://b.com,(555) 222-2222
3,Business C,"789 Blvd, OK",https://c.com,(555) 333-3333`;

    const businesses = await parseBusinessCSV(csvContent);

    expect(businesses).toHaveLength(3);
    expect(businesses[0].name).toBe('Business A');
    expect(businesses[1].name).toBe('Business B');
    expect(businesses[2].name).toBe('Business C');
  });

  test('skips businesses without websites', async () => {
    const csvContent = `ID,Name,Address,Website,Phone
1,With Website,"123 St, OK",https://test.com,(555) 111-1111
2,No Website,"456 Ave, OK",,(555) 222-2222
3,Another With,"789 Blvd, OK",https://another.com,(555) 333-3333`;

    const businesses = await parseBusinessCSV(csvContent);

    expect(businesses).toHaveLength(2);
    expect(businesses[0].name).toBe('With Website');
    expect(businesses[1].name).toBe('Another With');
  });

  test('normalizes website URLs', async () => {
    const csvContent = `ID,Name,Address,Website,Phone
1,Business A,"123 St, OK",test.com,(555) 111-1111
2,Business B,"456 Ave, OK",www.example.com,(555) 222-2222
3,Business C,"789 Blvd, OK",https://secure.com,(555) 333-3333`;

    const businesses = await parseBusinessCSV(csvContent);

    expect(businesses[0].website).toBe('https://test.com');
    expect(businesses[1].website).toBe('https://www.example.com');
    expect(businesses[2].website).toBe('https://secure.com');
  });

  test('handles empty CSV', async () => {
    const csvContent = `ID,Name,Address,Website,Phone`;

    const businesses = await parseBusinessCSV(csvContent);

    expect(businesses).toEqual([]);
  });

  test('handles CSV with only headers', async () => {
    const csvContent = `ID,Name,Address,Website,Phone
`;

    const businesses = await parseBusinessCSV(csvContent);

    expect(businesses).toEqual([]);
  });
});
