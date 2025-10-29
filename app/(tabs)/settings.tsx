import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '../../lib/state/profileStore';
import { getDefaultEmailTemplate } from '../../lib/email/emailService';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { profile, saveProfile, isLoading } = useProfileStore();
  const [email, setEmail] = useState('');
  const [emailTemplate, setEmailTemplate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setEmail(profile.email || '');
      setEmailTemplate(profile.emailTemplate || getDefaultEmailTemplate());
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedProfile = {
        ...profile,
        email: email.trim(),
        emailTemplate: emailTemplate.trim() || undefined
      };
      
      await saveProfile(updatedProfile);
      Alert.alert('Success', 'Settings saved successfully.');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetTemplate = () => {
    Alert.alert(
      'Reset Template',
      'Are you sure you want to reset the email template to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => setEmailTemplate(getDefaultEmailTemplate())
        }
      ]
    );
  };

  const handlePreviewTemplate = () => {
    const previewText = emailTemplate
      .replace(/{User Name}/g, profile?.fullName || 'John Smith')
      .replace(/{Date}/g, new Date().toLocaleDateString('en-AU'))
      .replace(/{Total Hours}/g, '2.5');
    
    Alert.alert(
      'Email Preview',
      `Subject: AVAC Submission - ${profile?.fullName || 'John Smith'}\n\n${previewText}`,
      [{ text: 'OK' }]
    );
  };

  if (isLoading && !profile) {
    return (
      <View style={[styles.container, styles.centerContent, isDark && styles.darkContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={[styles.loadingText, isDark && styles.darkText]}>
          Loading settings...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, isDark && styles.darkContainer]}>
      <View style={styles.content}>
        <Text style={[styles.title, isDark && styles.darkText]}>
          Email Settings
        </Text>
        
        <View style={[styles.section, isDark && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
            Email Address
          </Text>
          <Text style={[styles.sectionDescription, isDark && styles.darkText]}>
            Your Queensland Health email address for sending AVAC forms
          </Text>
          <TextInput
            style={[styles.textInput, isDark && styles.darkTextInput]}
            value={email}
            onChangeText={setEmail}
            placeholder="your.name@health.qld.gov.au"
            placeholderTextColor={isDark ? '#666' : '#999'}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={[styles.section, isDark && styles.darkSection]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
              Email Template
            </Text>
            <View style={styles.sectionActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.previewButton]}
                onPress={handlePreviewTemplate}
              >
                <Ionicons name="eye" size={16} color="#007AFF" />
                <Text style={styles.actionButtonText}>Preview</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.resetButton]}
                onPress={handleResetTemplate}
              >
                <Ionicons name="refresh" size={16} color="#FF9500" />
                <Text style={styles.actionButtonText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.sectionDescription, isDark && styles.darkText]}>
            Customize the email message sent with your AVAC forms. Use {'{User Name}'}, {'{Date}'}, and {'{Total Hours}'} as variables.
          </Text>
          <TextInput
            style={[styles.textArea, isDark && styles.darkTextInput]}
            value={emailTemplate}
            onChangeText={setEmailTemplate}
            placeholder="Enter your email template..."
            placeholderTextColor={isDark ? '#666' : '#999'}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="save" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Settings</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  darkContainer: {
    backgroundColor: '#000',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  darkSection: {
    backgroundColor: '#1c1c1e',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  sectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  previewButton: {
    backgroundColor: '#e3f2fd',
  },
  resetButton: {
    backgroundColor: '#fff3e0',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  darkTextInput: {
    borderColor: '#444',
    backgroundColor: '#2c2c2e',
    color: '#fff',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
    minHeight: 120,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  darkText: {
    color: '#fff',
  },
});
