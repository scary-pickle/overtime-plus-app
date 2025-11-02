import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Widget action handler - redirects to confirmation screen
 * Deep link format: overtime-plus://widget/[action]
 * Actions: start-shift, end-shift
 */
export default function WidgetActionHandler() {
  const params = useLocalSearchParams<{ action: 'start-shift' | 'end-shift' }>();
  const action = params.action || 'start-shift';
  
  // Redirect to confirm screen with the action parameter
  return <Redirect href={`/widget/confirm?action=${action}`} />;
}

