import React, { useState, useEffect, useRef } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfileStore } from '../lib/state/profileStore';
import { useLocalUserStore } from '../lib/state/localUserStore';
import { getDefaultEmailTemplate } from '../lib/email/emailService';
import { createScopedLogger } from '../lib/utils/logger';

const debug = createScopedLogger('EmailSettings');

export default function EmailSettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  
  const { localUserId } = useLocalUserStore();
  const { profile, saveProfile, isLoading } = useProfileStore();
  const [email, setEmail] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailTemplate, setEmailTemplate] = useState('');
  const [emailSubmissionMethod, setEmailSubmissionMethod] = useState<'apple-mail' | 'share-sheet'>('share-sheet');
  const [isSaving, setIsSaving] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const templateInputRef = useRef<TextInput>(null);
  const templateSectionRef = useRef<View>(null);
  const templateSectionY = useRef<number>(0);

  useEffect(() => {
    if (profile) {
      setEmail(profile.email || '');
      setRecipientEmail(profile.recipientEmail || '');
      setEmailTemplate(profile.emailTemplate || getDefaultEmailTemplate());
      setEmailSubmissionMethod(profile.emailSubmissionMethod || 'share-sheet');
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
    
    // Recipient email is optional, but if provided, must be valid
    if (recipientEmail && recipientEmail.trim() && !emailRegex.test(recipientEmail)) {
      Alert.alert('Invalid Recipient Email', 'Please enter a valid recipient email address or leave it empty.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedProfile = {
        ...profile,
        email: email.trim(),
        recipientEmail: recipientEmail.trim() || undefined,
        emailTemplate: emailTemplate.trim() || undefined,
        emailSubmissionMethod
      };
      
      await saveProfile(updatedProfile, localUserId);
      Alert.alert('Success', 'Email settings saved successfully.');
    } catch (error) {
      Alert.alert('Error', 'Failed to save email settings. Please try again.');
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
      .replace(/{Date}/g, new Date().toLocaleDateString('en-AU'));
    
    Alert.alert(
      'Email Preview',
      `Subject: AVAC Submission - ${profile?.fullName || 'John Smith'}\n\n${previewText}`,
      [{ text: 'OK' }]
    );
  };

  const handleSubmissionMethodChange = async (method: 'apple-mail' | 'share-sheet') => {
    setEmailSubmissionMethod(method);
    
    // Auto-save the submission method immediately
    if (profile) {
      try {
        const updatedProfile = {
          ...profile,
          emailSubmissionMethod: method
        };
        await saveProfile(updatedProfile, localUserId);
        
        // Show brief success message
        Alert.alert(
          'Saved',
          method === 'apple-mail' 
            ? 'Email submission will use Apple Mail with full auto-fill.'
            : 'Email submission will use Share Sheet (works with Outlook).',
          [{ text: 'OK' }]
        );
      } catch (error) {
        debug.error('Failed to save submission method:', error);
        Alert.alert('Error', 'Failed to save your preference. Please try again.');
      }
    }
  };

  if (isLoading && !profile) {
    return (
      <View style={[styles.container, styles.centerContent, isDark && styles.darkContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={[styles.loadingText, isDark && styles.darkText]}>
          Loading email settings...
        </Text>
      </View>
    );
  }

  const handleTemplateFocus = () => {
    // Small delay to ensure keyboard is shown before scrolling
    setTimeout(() => {
      if (templateSectionY.current > 0) {
        scrollViewRef.current?.scrollTo({ 
          y: Math.max(0, templateSectionY.current - 100), 
          animated: true 
        });
      } else {
        // Fallback: scroll to end if position not tracked yet
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    }, 300);
  };

  const handleTemplateSectionLayout = (event: any) => {
    const { y } = event.nativeEvent.layout;
    templateSectionY.current = y;
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDark && styles.darkContainer]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.content}>
        {/* Header with back button */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
          <Text style={[styles.title, isDark && styles.darkText]}>
            Email Settings
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        
        <View style={[styles.section, isDark && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
            Your Email Address
          </Text>
          <Text style={[styles.sectionDescription, isDark && styles.darkText]}>
            Your Queensland Health email address
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
            autoFocus={true}
          />
        </View>

        <View style={[styles.section, isDark && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
            AVAC Recipient Email
          </Text>
          <Text style={[styles.sectionDescription, isDark && styles.darkText]}>
            Email address where AVAC forms will be sent. If left empty, you can enter the recipient when you open your email app.
          </Text>
          <TextInput
            style={[styles.textInput, isDark && styles.darkTextInput]}
            value={recipientEmail}
            onChangeText={setRecipientEmail}
            placeholder="recipient@health.qld.gov.au (optional)"
            placeholderTextColor={isDark ? '#666' : '#999'}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={[styles.section, isDark && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDark && styles.darkText]}>
            Email Submission Method
          </Text>
          <Text style={[styles.sectionDescription, isDark && styles.darkText]}>
            Choose how you want to submit AVAC forms via email
          </Text>
          
          <TouchableOpacity
            style={[
              styles.radioOption,
              emailSubmissionMethod === 'apple-mail' && styles.radioOptionSelected,
              isDark && styles.darkRadioOption
            ]}
            onPress={() => handleSubmissionMethodChange('apple-mail')}
          >
            <View style={styles.radioButton}>
              {emailSubmissionMethod === 'apple-mail' && <View style={styles.radioButtonInner} />}
            </View>
            <View style={styles.radioContent}>
              <Text style={[styles.radioTitle, isDark && styles.darkText]}>
                Apple Mail (Auto-Fill Everything)
              </Text>
              <Text style={[styles.radioDescription, isDark && styles.darkText]}>
                Opens Apple Mail with recipient, subject, message, and PDF attachment all pre-filled. Everything is ready - just click send.
              </Text>
              <View style={styles.radioPros}>
                <Text style={styles.radioProsText}>✓ Fully automatic - zero manual work</Text>
                <Text style={styles.radioConsText}>✗ Only works with Apple Mail app</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.radioOption,
              emailSubmissionMethod === 'share-sheet' && styles.radioOptionSelected,
              isDark && styles.darkRadioOption
            ]}
            onPress={() => handleSubmissionMethodChange('share-sheet')}
          >
            <View style={styles.radioButton}>
              {emailSubmissionMethod === 'share-sheet' && <View style={styles.radioButtonInner} />}
            </View>
            <View style={styles.radioContent}>
              <Text style={[styles.radioTitle, isDark && styles.darkText]}>
                Share Sheet (Works with Outlook)
              </Text>
              <Text style={[styles.radioDescription, isDark && styles.darkText]}>
                Opens any email app you choose (Outlook, Gmail, etc.) with PDF automatically attached. Email details copied to clipboard for easy pasting.
              </Text>
              <View style={styles.radioPros}>
                <Text style={styles.radioProsText}>✓ Works with Outlook and any email app</Text>
                <Text style={styles.radioProsText}>✓ PDF automatically attached</Text>
                <Text style={styles.radioConsText}>✗ Requires one paste for email details</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View 
          ref={templateSectionRef} 
          style={[styles.section, isDark && styles.darkSection]}
          onLayout={handleTemplateSectionLayout}
        >
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
            Customise the email message sent with your AVAC forms. Use {'{User Name}'} and {'{Date}'} as variables.
          </Text>
          <TextInput
            ref={templateInputRef}
            style={[styles.textArea, isDark && styles.darkTextInput]}
            value={emailTemplate}
            onChangeText={setEmailTemplate}
            placeholder="Enter your email template..."
            placeholderTextColor={isDark ? '#666' : '#999'}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            onFocus={handleTemplateFocus}
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
    </KeyboardAvoidingView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 10,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  headerSpacer: {
    width: 40, // Same width as back button to center the title
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
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    flex: 1,
    marginRight: 12,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  sectionActions: {
    flexDirection: 'row',
    gap: 12,
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
  radioOption: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  radioOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  darkRadioOption: {
    backgroundColor: '#2c2c2e',
    borderColor: '#444',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    marginRight: 12,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  radioContent: {
    flex: 1,
  },
  radioTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  radioDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  radioPros: {
    marginTop: 4,
  },
  radioProsText: {
    fontSize: 13,
    color: '#34C759',
    marginBottom: 2,
  },
  radioConsText: {
    fontSize: 13,
    color: '#FF9500',
    marginBottom: 2,
  },
});
