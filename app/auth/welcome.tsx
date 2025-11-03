import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { Link } from 'expo-router';

export default function Welcome() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B2239' }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text style={{ fontSize: 36, fontWeight: '800', color: '#fff', textAlign: 'center' }}>Overtime+</Text>
        <Text style={{ color: '#cfe0f7', textAlign: 'center', marginTop: 8 }}>
          Track shifts and overtime securely across devices.
        </Text>
        <View style={{ marginTop: 24, gap: 12 }}>
          <Link href="/auth/sign-in" asChild>
            <TouchableOpacity style={{ backgroundColor: '#2563EB', borderRadius: 12, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Sign In</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/auth/sign-up" asChild>
            <TouchableOpacity style={{ backgroundColor: '#10B981', borderRadius: 12, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Create Account</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}


