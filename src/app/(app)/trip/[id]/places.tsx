import { Redirect, useLocalSearchParams } from 'expo-router';

export default function PlacesRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/trip/[id]/vote', params: { id, seg: 'places' } }} />;
}
