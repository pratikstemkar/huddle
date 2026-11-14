import { Redirect, useLocalSearchParams } from 'expo-router';

export default function DaysRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/trip/[id]/vote', params: { id, seg: 'dates' } }} />;
}
