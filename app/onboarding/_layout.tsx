import { Stack } from 'expo-router';
import { ErrorBoundary } from '../../components/ErrorBoundary';

export default function OnboardingLayout() {
  return (
    <ErrorBoundary>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="welcome" />
        <Stack.Screen name="how-it-works" />
        <Stack.Screen name="profile-setup" />
        <Stack.Screen name="location-permissions" />
        <Stack.Screen name="create-first-log" />
        <Stack.Screen name="complete" />
      </Stack>
    </ErrorBoundary>
  );
}






