import 'react-native-reanimated';
import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../lib/state/authStore';

export default function Index() {
  const { checkSession, user, emailVerified, isLoading } = useAuthStore();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      await checkSession();
      setChecked(true);
    })();
  }, [checkSession]);

  if (!checked || isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/auth/welcome" />;
  }

  if (!emailVerified) {
    return <Redirect href="/auth/verify-email" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
