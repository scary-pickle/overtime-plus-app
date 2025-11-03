import React from 'react';
import { View, Text, Button } from 'react-native';
import { Link } from 'expo-router';

export default function Welcome() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 28, fontWeight: '600', marginBottom: 12 }}>Overtime+</Text>
      <Text style={{ textAlign: 'center', marginBottom: 24 }}>
        Track shifts and overtime securely. Please sign in or create an account.
      </Text>
      <View style={{ width: '100%', gap: 12 }}>
        <Link href="/auth/sign-in" asChild>
          <Button title="Sign In" />
        </Link>
        <Link href="/auth/sign-up" asChild>
          <Button title="Create Account" />
        </Link>
      </View>
    </View>
  );
}


