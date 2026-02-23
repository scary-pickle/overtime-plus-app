import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  Switch,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLocalUserStore } from '../../lib/state/localUserStore';
import { useProfileStore } from '../../lib/state/profileStore';
import { Profile } from '../../types';
import { validateOnboardingProfile } from '../../lib/validation/onboardingValidation';
import { HospitalDropdown } from '../../components/HospitalDropdown';
import { DepartmentDropdown } from '../../components/DepartmentDropdown';
import { QUEENSLAND_HOSPITALS, getDepartmentsForHospital, getDelegateForDepartment } from '../../lib/data/hospitalDepartments';
import { profileStorage } from '../../lib/storage/profile';
import { createScopedLogger } from '../../lib/utils/logger';

const debug = createScopedLogger('OnboardingProfileSetup');

export default function OnboardingProfileSetup() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { localUserId } = useLocalUserStore();
  const { saveProfile } = useProfileStore();

  const scrollViewRef = useRef<ScrollView>(null);
  const fullNameInputRef = useRef<TextInput>(null);
  const payrollNumberInputRef = useRef<TextInput>(null);
  const orgUnitNoInputRef = useRef<TextInput>(null);
  const payLevelInputRef = useRef<TextInput>(null);
  const delegateNameInputRef = useRef<TextInput>(null);
  const delegatePositionInputRef = useRef<TextInput>(null);
  const delegateAreaCodeInputRef = useRef<TextInput>(null);
  const delegatePhoneInputRef = useRef<TextInput>(null);

  const fieldPositions = useRef<{ [key: string]: number }>({});

  const [formData, setFormData] = useState<Partial<Profile>>({
    email: '',
    fullName: '',
    payrollNumber: '',
    orgUnitNo: '',
    orgUnitName: '',
    location: '',
    payLevel: '',
    isSMO: false,
    delegateName: '',
    delegatePosition: '',
    delegateAreaCode: '(07)',
    delegatePhone: '',
    employeeInitial: '',
    pdfTemplateVersion: 'qld_avac_v8.5',
    timezone: 'Australia/Brisbane',
    concurrentEmploymentDefault: false,
  });

  const [selectedHospital, setSelectedHospital] = useState('');
  const [customHospitals, setCustomHospitals] = useState<string[]>([]);
  const [customDepartments, setCustomDepartments] = useState<string[]>([]);
  const [isDelegateAutoFilled, setIsDelegateAutoFilled] = useState(false);


  const generateEmployeeInitial = (fullName: string): string => {
    const names = fullName.trim().split(' ');
    if (names.length === 1) {
      return names[0].substring(0, 2).toUpperCase();
    }
    return names.map(name => name.charAt(0)).join('').toUpperCase().substring(0, 3);
  };

  const scrollToInput = (inputRef: React.RefObject<TextInput>, fieldKey: string) => {
    // Use setTimeout to ensure keyboard is shown before scrolling
    setTimeout(() => {
      const position = fieldPositions.current[fieldKey];
      if (position !== undefined && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({
          y: Math.max(0, position - 150), // Scroll to show input with 150px padding from top
          animated: true,
        });
      }
    }, 150); // Slightly longer delay to ensure keyboard is fully shown
  };

  const handleFieldLayout = (fieldKey: string, event: any) => {
    const { y } = event.nativeEvent.layout;
    fieldPositions.current[fieldKey] = y;
  };

  const handleFullNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      fullName: value,
      employeeInitial: value.trim() ? generateEmployeeInitial(value) : '',
    }));
  };

  const handleHospitalChange = (hospitalName: string) => {
    setSelectedHospital(hospitalName);
    setFormData(prev => ({
      ...prev,
      location: hospitalName,
      orgUnitName: '',
      orgUnitNo: '',
      delegateName: '',
      delegatePosition: '',
      delegatePhone: '',
    }));
    setIsDelegateAutoFilled(false);
  };

  const handleDepartmentChange = (department: string) => {
    setFormData(prev => ({ ...prev, orgUnitName: department }));
    
    // Auto-fill delegate details if hospital and department are selected
    if (selectedHospital && department) {
      const delegateInfo = getDelegateForDepartment(selectedHospital, department);
      if (delegateInfo) {
        setFormData(prev => ({
          ...prev,
          delegateName: delegateInfo.delegateName,
          delegatePosition: delegateInfo.delegatePosition,
          delegatePhone: delegateInfo.delegatePhone,
        }));
        setIsDelegateAutoFilled(true);
      }
    }
  };

  const handleCustomHospitalAdd = (hospital: string) => {
    if (!customHospitals.includes(hospital)) {
      setCustomHospitals(prev => [...prev, hospital]);
    }
  };

  const handleCustomDepartmentAdd = (department: string) => {
    if (!customDepartments.includes(department)) {
      setCustomDepartments(prev => [...prev, department]);
    }
  };

  const handleContinue = async () => {
    // Validate form
    const validation = validateOnboardingProfile(formData);
    
    if (!validation.isValid) {
      const missingFields = validation.missingFields.map(f => f.label).join(', ');
      Alert.alert(
        'Missing Required Fields',
        `Please fill in the following fields: ${missingFields}`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Create complete profile
    const profileData: Profile = {
      fullName: formData.fullName || '',
      payrollNumber: formData.payrollNumber || '',
      orgUnitNo: formData.orgUnitNo || '',
      orgUnitName: formData.orgUnitName || '',
      location: formData.location || '',
      payLevel: formData.payLevel || '',
      serviceEnquiryNumber: formData.serviceEnquiryNumber || '',
      delegateName: formData.delegateName || '',
      delegatePosition: formData.delegatePosition || '',
      delegateAreaCode: formData.delegateAreaCode || '(07)',
      delegatePhone: formData.delegatePhone || '',
      employeeInitial: formData.employeeInitial || '',
      pdfTemplateVersion: 'qld_avac_v8.5',
      timezone: 'Australia/Brisbane',
      concurrentEmploymentDefault: false,
      email: formData.email || '',
      isSMO: formData.isSMO || false,
    };

    try {
      await saveProfile(profileData, localUserId);
      router.push('/onboarding/create-first-log');
    } catch (error) {
      debug.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    }
  };

  const validation = validateOnboardingProfile(formData);
  const canContinue = validation.isValid;

  return (
    <SafeAreaView style={[styles.container, isDark && styles.darkContainer]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View>
        <View style={styles.header}>
          <Text style={[styles.title, isDark && styles.darkTitle]}>Set Up Your Profile</Text>
          <Text style={[styles.subtitle, isDark && styles.darkSubtitle]}>
            Let's get your profile ready. We'll use this information to generate your AVAC forms.
          </Text>
        </View>

        {/* Personal Information */}
        <View style={[styles.section, isDark && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDark && styles.darkSectionTitle]}>Personal Information</Text>
          
          <View style={styles.field}>
            <Text style={[styles.label, isDark && styles.darkLabel]}>
              Email Address (Optional)
            </Text>
            <TextInput
              style={[styles.input, isDark && styles.darkInput]}
              value={formData.email}
              onChangeText={(value) => setFormData(prev => ({ ...prev, email: value }))}
              placeholder="your.email@health.qld.gov.au"
              placeholderTextColor={isDark ? '#666' : '#999'}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={[styles.helperText, isDark && styles.darkHelperText]}>
              Used on AVAC forms — you can add this later in your profile
            </Text>
          </View>

          <View 
            style={styles.field}
            onLayout={(e) => handleFieldLayout('fullName', e)}
          >
            <Text style={[styles.label, isDark && styles.darkLabel]}>
              Full Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              ref={fullNameInputRef}
              style={[styles.input, isDark && styles.darkInput]}
              value={formData.fullName}
              onChangeText={handleFullNameChange}
              placeholder="Enter your full name"
              placeholderTextColor={isDark ? '#666' : '#999'}
              autoFocus={true}
              onFocus={() => scrollToInput(fullNameInputRef, 'fullName')}
            />
            <Text style={[styles.helperText, isDark && styles.darkHelperText]}>
              {formData.fullName ? 'You can edit this if needed' : 'Auto-filled from your email'}
            </Text>
          </View>

          <View 
            style={styles.field}
            onLayout={(e) => handleFieldLayout('payrollNumber', e)}
          >
            <Text style={[styles.label, isDark && styles.darkLabel]}>
              Payroll Number <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              ref={payrollNumberInputRef}
              style={[styles.input, isDark && styles.darkInput]}
              value={formData.payrollNumber}
              onChangeText={(value) => setFormData(prev => ({ ...prev, payrollNumber: value }))}
              placeholder="Enter payroll number"
              placeholderTextColor={isDark ? '#666' : '#999'}
              onFocus={() => scrollToInput(payrollNumberInputRef, 'payrollNumber')}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, isDark && styles.darkLabel]}>
              Employee Initial <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.disabledInput, isDark && styles.darkInput, isDark && styles.darkDisabledInput]}
              value={formData.employeeInitial}
              editable={false}
              placeholder="Auto-generated"
              placeholderTextColor={isDark ? '#666' : '#999'}
            />
            <Text style={[styles.helperText, isDark && styles.darkHelperText]}>
              Auto-generated from your name
            </Text>
          </View>
        </View>

        {/* Organisational Details */}
        <View style={[styles.section, isDark && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDark && styles.darkSectionTitle]}>Organisational Details</Text>
          
          <View style={styles.field}>
            <Text style={[styles.label, isDark && styles.darkLabel]}>
              Hospital <Text style={styles.required}>*</Text>
            </Text>
            <HospitalDropdown
              value={selectedHospital}
              onValueChange={handleHospitalChange}
              placeholder="Select hospital"
              required={true}
              customHospitals={customHospitals}
              onCustomHospitalAdd={handleCustomHospitalAdd}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, isDark && styles.darkLabel]}>
              Department <Text style={styles.required}>*</Text>
            </Text>
            <DepartmentDropdown
              value={formData.orgUnitName || ''}
              onValueChange={handleDepartmentChange}
              placeholder={selectedHospital ? "Select department" : "Select hospital first"}
              required={true}
              disabled={!selectedHospital}
              departments={selectedHospital ? (() => {
                const hospital = QUEENSLAND_HOSPITALS.find(h => h.name === selectedHospital);
                return hospital ? hospital.departments : [];
              })() : []}
              customDepartments={customDepartments}
              onCustomDepartmentAdd={handleCustomDepartmentAdd}
            />
          </View>

          <View 
            style={styles.field}
            onLayout={(e) => handleFieldLayout('orgUnitNo', e)}
          >
            <Text style={[styles.label, isDark && styles.darkLabel]}>
              Organisation Unit No (Optional)
            </Text>
            <TextInput
              ref={orgUnitNoInputRef}
              style={[styles.input, isDark && styles.darkInput]}
              value={formData.orgUnitNo}
              onChangeText={(value) => setFormData(prev => ({ ...prev, orgUnitNo: value }))}
              placeholder="Enter org unit number"
              placeholderTextColor={isDark ? '#666' : '#999'}
              maxLength={8}
              keyboardType="numeric"
              onFocus={() => scrollToInput(orgUnitNoInputRef, 'orgUnitNo')}
            />
            <Text style={[styles.helperText, isDark && styles.darkHelperText]}>
              You can skip this for now. We'll remind you before exporting AVAC forms.
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, isDark && styles.darkLabel]}>
              Are you an SMO? <Text style={styles.required}>*</Text>
            </Text>
            <View style={[styles.toggleContainer, isDark && styles.darkToggleContainer]}>
              <Text style={[styles.toggleLabel, isDark && styles.darkToggleLabel]}>
                {formData.isSMO ? 'Yes' : 'No'}
              </Text>
              <Switch
                value={formData.isSMO}
                onValueChange={(value) => {
                  setFormData(prev => ({
                    ...prev,
                    isSMO: value,
                    payLevel: value ? '' : prev.payLevel, // Clear payLevel if SMO
                  }));
                }}
                trackColor={{ false: isDark ? '#444' : '#e0e0e0', true: '#4CAF50' }}
                thumbColor={formData.isSMO ? '#fff' : isDark ? '#666' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Pay Level - only show when not SMO */}
          {!formData.isSMO && (
            <View 
              style={styles.field}
              onLayout={(e) => handleFieldLayout('payLevel', e)}
            >
              <Text style={[styles.label, isDark && styles.darkLabel]}>
                Pay Level <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                ref={payLevelInputRef}
                style={[styles.input, isDark && styles.darkInput]}
                value={formData.payLevel}
                onChangeText={(value) => setFormData(prev => ({ ...prev, payLevel: value }))}
                placeholder="Enter pay level"
                placeholderTextColor={isDark ? '#666' : '#999'}
                onFocus={() => scrollToInput(payLevelInputRef, 'payLevel')}
              />
            </View>
          )}
        </View>

        {/* Delegate Information - Optional */}
        <View style={[styles.section, isDark && styles.darkSection]}>
          <Text style={[styles.sectionTitle, isDark && styles.darkSectionTitle]}>
            Delegate Information (Optional)
          </Text>
          <Text style={[styles.sectionDescription, isDark && styles.darkSectionDescription]}>
            You can skip this for now and add it later. Delegate information is required when generating PDFs.
          </Text>

          {isDelegateAutoFilled && (
            <View style={[styles.infoBanner, isDark && styles.darkInfoBanner]}>
              <Ionicons name="information-circle" size={20} color={isDark ? "#4fc3f7" : "#007AFF"} />
              <Text style={[styles.infoText, isDark && styles.darkInfoText]}>
                Delegate details auto-filled from your department
              </Text>
            </View>
          )}

          <View 
            style={styles.field}
            onLayout={(e) => handleFieldLayout('delegateName', e)}
          >
            <Text style={[styles.label, isDark && styles.darkLabel]}>Delegate Name</Text>
            <TextInput
              ref={delegateNameInputRef}
              style={[styles.input, isDark && styles.darkInput]}
              value={formData.delegateName}
              onChangeText={(value) => {
                setFormData(prev => ({ ...prev, delegateName: value }));
                setIsDelegateAutoFilled(false);
              }}
              placeholder="Enter delegate name"
              placeholderTextColor={isDark ? '#666' : '#999'}
              onFocus={() => scrollToInput(delegateNameInputRef, 'delegateName')}
            />
          </View>

          <View 
            style={styles.field}
            onLayout={(e) => handleFieldLayout('delegatePosition', e)}
          >
            <Text style={[styles.label, isDark && styles.darkLabel]}>Delegate Position</Text>
            <TextInput
              ref={delegatePositionInputRef}
              style={[styles.input, isDark && styles.darkInput]}
              value={formData.delegatePosition}
              onChangeText={(value) => {
                setFormData(prev => ({ ...prev, delegatePosition: value }));
                setIsDelegateAutoFilled(false);
              }}
              placeholder="Enter delegate position"
              placeholderTextColor={isDark ? '#666' : '#999'}
              onFocus={() => scrollToInput(delegatePositionInputRef, 'delegatePosition')}
            />
          </View>

          <View 
            style={styles.field}
            onLayout={(e) => handleFieldLayout('delegateAreaCode', e)}
          >
            <Text style={[styles.label, isDark && styles.darkLabel]}>Area Code</Text>
            <TextInput
              ref={delegateAreaCodeInputRef}
              style={[styles.input, isDark && styles.darkInput]}
              value={formData.delegateAreaCode}
              onChangeText={(value) => setFormData(prev => ({ ...prev, delegateAreaCode: value }))}
              placeholder="(07)"
              placeholderTextColor={isDark ? '#666' : '#999'}
              keyboardType="phone-pad"
              onFocus={() => scrollToInput(delegateAreaCodeInputRef, 'delegateAreaCode')}
            />
          </View>

          <View 
            style={styles.field}
            onLayout={(e) => handleFieldLayout('delegatePhone', e)}
          >
            <Text style={[styles.label, isDark && styles.darkLabel]}>Phone Number</Text>
            <TextInput
              ref={delegatePhoneInputRef}
              style={[styles.input, isDark && styles.darkInput]}
              value={formData.delegatePhone}
              onChangeText={(value) => {
                setFormData(prev => ({ ...prev, delegatePhone: value }));
                setIsDelegateAutoFilled(false);
              }}
              placeholder="Enter phone number"
              placeholderTextColor={isDark ? '#666' : '#999'}
              keyboardType="phone-pad"
              onFocus={() => scrollToInput(delegatePhoneInputRef, 'delegatePhone')}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, !canContinue && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <Text style={styles.buttonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  darkContainer: {
    backgroundColor: '#000',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111',
    marginBottom: 16,
    textAlign: 'center',
  },
  darkTitle: {
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    textAlign: 'center',
  },
  darkSubtitle: {
    color: '#aaa',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  darkSection: {
    backgroundColor: '#1c1c1e',
    borderColor: '#333',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111',
    marginBottom: 16,
  },
  darkSectionTitle: {
    color: '#fff',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  darkSectionDescription: {
    color: '#aaa',
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  darkLabel: {
    color: '#fff',
  },
  required: {
    color: '#ff4444',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111',
  },
  darkInput: {
    backgroundColor: '#2c2c2e',
    borderColor: '#444',
    color: '#fff',
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
  darkDisabledInput: {
    backgroundColor: '#2c2c2e',
    color: '#999',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  darkHelperText: {
    color: '#aaa',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
  },
  darkToggleContainer: {
    backgroundColor: '#2c2c2e',
    borderColor: '#444',
  },
  toggleLabel: {
    fontSize: 16,
    color: '#111',
    fontWeight: '500',
  },
  darkToggleLabel: {
    color: '#fff',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  darkInfoBanner: {
    backgroundColor: '#1a237e',
  },
  infoText: {
    fontSize: 14,
    color: '#1565C0',
    flex: 1,
  },
  darkInfoText: {
    color: '#90caf9',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    width: '100%',
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});







