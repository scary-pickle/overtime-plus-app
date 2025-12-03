import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/state/authStore';
import { useProfileStore } from '../../lib/state/profileStore';
import { Profile } from '../../types';
import { parseNameFromEmail } from '../../lib/utils/emailNameParser';
import { validateOnboardingProfile } from '../../lib/validation/onboardingValidation';
import { HospitalDropdown } from '../../components/HospitalDropdown';
import { DepartmentDropdown } from '../../components/DepartmentDropdown';
import { QUEENSLAND_HOSPITALS, getDepartmentsForHospital, getDelegateForDepartment } from '../../lib/data/hospitalDepartments';
import { profileStorage } from '../../lib/storage/profile';
import { createScopedLogger } from '../../lib/utils/logger';

const debug = createScopedLogger('OnboardingProfileSetup');

export default function OnboardingProfileSetup() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { saveProfile } = useProfileStore();

  const [formData, setFormData] = useState<Partial<Profile>>({
    email: user?.email || '',
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

  // Auto-fill email and name on mount
  useEffect(() => {
    if (user?.email) {
      const parsedName = parseNameFromEmail(user.email);
      setFormData(prev => ({
        ...prev,
        email: user.email || '',
        fullName: parsedName || prev.fullName,
        employeeInitial: parsedName ? generateEmployeeInitial(parsedName) : '',
      }));
    }
  }, [user?.email]);

  const generateEmployeeInitial = (fullName: string): string => {
    const names = fullName.trim().split(' ');
    if (names.length === 1) {
      return names[0].substring(0, 2).toUpperCase();
    }
    return names.map(name => name.charAt(0)).join('').toUpperCase().substring(0, 3);
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
      email: formData.email || user?.email || '',
      isSMO: formData.isSMO || false,
    };

    try {
      await saveProfile(profileData, user?.id);
      router.push('/onboarding/complete');
    } catch (error) {
      debug.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    }
  };

  const validation = validateOnboardingProfile(formData);
  const canContinue = validation.isValid;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Set Up Your Profile</Text>
          <Text style={styles.subtitle}>
            Let's get your profile ready. We'll use this information to generate your AVAC forms.
          </Text>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.field}>
            <Text style={styles.label}>
              Email Address
            </Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={formData.email}
              editable={false}
              placeholder="your.email@health.qld.gov.au"
              placeholderTextColor="#999"
            />
            <Text style={styles.helperText}>
              This is the email you signed in with
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Full Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={formData.fullName}
              onChangeText={handleFullNameChange}
              placeholder="Enter your full name"
              placeholderTextColor="#999"
            />
            <Text style={styles.helperText}>
              {formData.fullName ? 'You can edit this if needed' : 'Auto-filled from your email'}
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Payroll Number <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={formData.payrollNumber}
              onChangeText={(value) => setFormData(prev => ({ ...prev, payrollNumber: value }))}
              placeholder="Enter payroll number"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Employee Initial <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={formData.employeeInitial}
              editable={false}
              placeholder="Auto-generated"
              placeholderTextColor="#999"
            />
            <Text style={styles.helperText}>
              Auto-generated from your name
            </Text>
          </View>
        </View>

        {/* Organizational Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organizational Details</Text>
          
          <View style={styles.field}>
            <Text style={styles.label}>
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
            <Text style={styles.label}>
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

          <View style={styles.field}>
            <Text style={styles.label}>
              Organisation Unit No (Optional)
            </Text>
            <TextInput
              style={styles.input}
              value={formData.orgUnitNo}
              onChangeText={(value) => setFormData(prev => ({ ...prev, orgUnitNo: value }))}
              placeholder="Enter org unit number"
              placeholderTextColor="#999"
              maxLength={8}
            />
            <Text style={styles.helperText}>
              You can skip this for now. We'll remind you before exporting AVAC forms.
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Are you an SMO? <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>
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
                trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
                thumbColor={formData.isSMO ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Pay Level - only show when not SMO */}
          {!formData.isSMO && (
            <View style={styles.field}>
              <Text style={styles.label}>
                Pay Level <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={formData.payLevel}
                onChangeText={(value) => setFormData(prev => ({ ...prev, payLevel: value }))}
                placeholder="Enter pay level"
                placeholderTextColor="#999"
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>
              Service Enquiry Number (Optional)
            </Text>
            <TextInput
              style={styles.input}
              value={formData.serviceEnquiryNumber}
              onChangeText={(value) => setFormData(prev => ({ ...prev, serviceEnquiryNumber: value }))}
              placeholder="Optional"
              placeholderTextColor="#999"
            />
          </View>
        </View>

        {/* Delegate Information - Optional */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Delegate Information (Optional)
          </Text>
          <Text style={styles.sectionDescription}>
            You can skip this for now and add it later. Delegate information is required when generating PDFs.
          </Text>

          {isDelegateAutoFilled && (
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={20} color="#007AFF" />
              <Text style={styles.infoText}>
                Delegate details auto-filled from your department
              </Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Delegate Name</Text>
            <TextInput
              style={styles.input}
              value={formData.delegateName}
              onChangeText={(value) => {
                setFormData(prev => ({ ...prev, delegateName: value }));
                setIsDelegateAutoFilled(false);
              }}
              placeholder="Enter delegate name"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Delegate Position</Text>
            <TextInput
              style={styles.input}
              value={formData.delegatePosition}
              onChangeText={(value) => {
                setFormData(prev => ({ ...prev, delegatePosition: value }));
                setIsDelegateAutoFilled(false);
              }}
              placeholder="Enter delegate position"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Area Code</Text>
            <TextInput
              style={styles.input}
              value={formData.delegateAreaCode}
              onChangeText={(value) => setFormData(prev => ({ ...prev, delegateAreaCode: value }))}
              placeholder="(07)"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={formData.delegatePhone}
              onChangeText={(value) => {
                setFormData(prev => ({ ...prev, delegatePhone: value }));
                setIsDelegateAutoFilled(false);
              }}
              placeholder="Enter phone number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  subtitle: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111',
    marginBottom: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
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
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
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
  toggleLabel: {
    fontSize: 16,
    color: '#111',
    fontWeight: '500',
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
  infoText: {
    fontSize: 14,
    color: '#1565C0',
    flex: 1,
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







