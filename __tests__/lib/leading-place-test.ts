import { queueResult } from '../../test-utils/supabase-mock';
import { leadingPlaceName } from '@/lib/trips';

describe('leadingPlaceName', () => {
  it('names the place with the most votes, earliest first on a tie', async () => {
    queueResult('destinations', {
      data: [
        { id: 'a', title: 'Palolem', created_at: '2027-01-02' },
        { id: 'b', title: 'Hampi', created_at: '2027-01-01' },
        { id: 'c', title: 'Gokarna', created_at: '2027-01-03' },
      ],
    });
    queueResult('votes', {
      data: [
        { destination_id: 'a', user_id: 'u1' },
        { destination_id: 'b', user_id: 'u2' },
        { destination_id: 'c', user_id: 'u3' },
        { destination_id: 'a', user_id: 'u3' },
      ],
    });
    expect(await leadingPlaceName('t1')).toBe('Palolem');
  });

  it('is null with no votes, no places or an error', async () => {
    queueResult('destinations', { data: [{ id: 'a', title: 'Palolem', created_at: '' }] });
    queueResult('votes', { data: [] });
    expect(await leadingPlaceName('t1')).toBeNull();

    queueResult('destinations', { data: [] });
    expect(await leadingPlaceName('t1')).toBeNull();

    queueResult('destinations', { data: null, error: { message: 'offline' } });
    expect(await leadingPlaceName('t1')).toBeNull();
  });
});
