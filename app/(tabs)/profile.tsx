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
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useProfileStore } from '../../lib/state/profileStore';
import { EmptyState } from '../../components/EmptyState';
import { DepartmentDropdown } from '../../components/DepartmentDropdown';
import { HospitalDropdown } from '../../components/HospitalDropdown';
import { getDepartmentsForHospital, getHospitalById, QUEENSLAND_HOSPITALS, getOrgUnitForDepartment, getDelegateForDepartment } from '../../lib/data/hospitalDepartments';
import { Profile } from '../../types';

export default function ProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { profile, saveProfile, loadProfile, isComplete } = useProfileStore();
  const [formData, setFormData] = useState<Partial<Profile>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [selectedHospital, setSelectedHospital] = useState('');
  const [isDelegateAutoFilled, setIsDelegateAutoFilled] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (profile) {
      setFormData(profile);
      setSelectedHospital(profile.location || '');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!formData.fullName || !formData.payrollNumber || !formData.email) {
      Alert.alert('Required Fields', 'Please fill in all required fields.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

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
      concurrentEmploymentDefault: formData.concurrentEmploymentDefault || false,
      email: formData.email || '',
      emailTemplate: formData.emailTemplate,
    };

    console.log('Form data before saving:', {
      hasEmployeeInitial: !!formData.employeeInitial,
      employeeInitial: formData.employeeInitial
    });
    
    console.log('Profile data being saved:', {
      hasEmployeeInitial: !!formData.employeeInitial,
      employeeInitial: formData.employeeInitial,
      allFields: Object.keys(profileData)
    });

    try {
      await saveProfile(profileData);
      setIsEditing(false);
      console.log('Profile saved successfully, profileData:', profileData);
      Alert.alert('Success', 'Profile saved successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData(profile);
    }
    setIsEditing(false);
  };

  const generateEmployeeInitial = (fullName: string): string => {
    const names = fullName.trim().split(' ');
    if (names.length === 1) {
      return names[0].substring(0, 2).toUpperCase();
    }
    return names.map(name => name.charAt(0)).join('').toUpperCase().substring(0, 3);
  };

  const handleFullNameChange = (value: string) => {
    setFormData(prev => {
      const updated = { ...prev, fullName: value };
      // Auto-generate employee initial from full name
      if (value.trim()) {
        updated.employeeInitial = generateEmployeeInitial(value);
      }
      return updated;
    });
  };

  const updateField = (field: keyof Profile, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleHospitalChange = (hospitalName: string) => {
    setSelectedHospital(hospitalName);
    setFormData(prev => ({ ...prev, location: hospitalName }));
    // Clear department, org unit, and delegate when hospital changes
    setFormData(prev => ({ ...prev, orgUnitName: '', orgUnitNo: '', delegateName: '', delegatePosition: '', delegatePhone: '' }));
    setIsDelegateAutoFilled(false);
  };

  const handleDepartmentChange = (department: string) => {
    setFormData(prev => ({ ...prev, orgUnitName: department }));
    
    // Auto-fill organisational unit number and delegate details if hospital and department are selected
    if (selectedHospital && department) {
      const orgUnitNo = getOrgUnitForDepartment(selectedHospital, department);
      if (orgUnitNo) {
        setFormData(prev => ({ ...prev, orgUnitNo }));
      }
      
      // Auto-fill delegate details
      const delegateInfo = getDelegateForDepartment(selectedHospital, department);
      if (delegateInfo) {
        setFormData(prev => ({ 
          ...prev, 
          delegateName: delegateInfo.delegateName,
          delegatePosition: delegateInfo.delegatePosition,
          delegatePhone: delegateInfo.delegatePhone
        }));
        setIsDelegateAutoFilled(true);
      }
    }
  };

  const renderField = (
    label: string,
    field: keyof Profile,
    placeholder: string,
    required: boolean = false
  ) => (
    <View style={styles.field}>
      <Text style={[styles.label, isDark && styles.darkLabel]}>
        {label} {required && <Text style={[styles.required, isDark && styles.darkRequired]}>*</Text>}
      </Text>
      <TextInput
        style={[
          styles.input,
          isDark && styles.darkInput,
          !isEditing && styles.disabledInput,
          !isEditing && isDark && styles.darkDisabledInput,
        ]}
        value={formData[field] as string || ''}
        onChangeText={(value) => updateField(field, value)}
        placeholder={placeholder}
        placeholderTextColor={isDark ? '#666' : '#999'}
        editable={isEditing}
      />
    </View>
  );

  if (!profile && !isEditing) {
    return (
      <EmptyState
        title="Set Up Your Profile"
        description="Complete your profile to start using Overtime+. This information will be used to generate your AVAC forms."
        actionText="Create Profile"
        onAction={() => setIsEditing(true)}
        icon="👤"
      />
    );
  }

  return (
    <ScrollView style={[styles.container, isDark && styles.darkContainer]}>
      <View style={styles.content}>
        {/* Header */}
        <View style={[styles.header, isDark && styles.darkCard]}>
          <Text style={[styles.title, isDark && styles.darkText]}>
            Profile
          </Text>
          <Text style={[styles.subtitle, isDark && styles.darkSubtitle]}>
            {isComplete ? 'Complete' : 'Incomplete'}
          </Text>
        </View>

        {/* Employee Details */}
        <View style={[styles.section, isDark && styles.darkCard]}>
          <Text style={[styles.sectionTitle, isDark && styles.darkSectionTitle]}>
            Employee Details
          </Text>
          
          <View style={styles.field}>
            <Text style={[styles.label, isDark && styles.darkLabel]}>
              Full Name <Text style={[styles.required, isDark && styles.darkRequired]}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                isDark && styles.darkInput,
                !isEditing && styles.disabledInput,
                !isEditing && isDark && styles.darkDisabledInput,
              ]}
              value={formData.fullName || ''}
              onChangeText={handleFullNameChange}
              placeholder='Enter your full name'
              placeholderTextColor={isDark ? '#666' : '#999'}
              editable={isEditing}
            />
          </View>
          {renderField('Payroll Number', 'payrollNumber', 'Enter payroll number', true)}
          {renderField('Pay Level', 'payLevel', 'Enter pay level', true)}
          {renderField('Employee Initial', 'employeeInitial', 'Auto-generated from full name', true)}
          {renderField('Email Address', 'email', 'your.name@health.qld.gov.au', true)}
        </View>

        {/* Organisation Details */}
        <View style={[styles.section, isDark && styles.darkCard]}>
          <Text style={[styles.sectionTitle, isDark && styles.darkSectionTitle]}>
            Organisation
          </Text>
          
          <View style={styles.field}>
            <Text style={[styles.label, isDark && styles.darkLabel]}>
              Hospital <Text style={[styles.required, isDark && styles.darkRequired]}>*</Text>
            </Text>
            <HospitalDropdown
              value={selectedHospital}
              onValueChange={handleHospitalChange}
              placeholder="Select hospital"
              required={true}
              disabled={!isEditing}
            />
          </View>
          
          <View style={styles.field}>
            <Text style={[styles.label, isDark && styles.darkLabel]}>
              Department <Text style={[styles.required, isDark && styles.darkRequired]}>*</Text>
            </Text>
            <DepartmentDropdown
              value={formData.orgUnitName || ''}
              onValueChange={handleDepartmentChange}
              placeholder={selectedHospital ? "Select department" : "Select hospital first"}
              required={true}
              disabled={!isEditing || !selectedHospital}
              departments={selectedHospital ? (() => {
                const hospital = QUEENSLAND_HOSPITALS.find(h => h.name === selectedHospital);
                return hospital ? hospital.departments : [];
              })() : []}
            />
          </View>
          
          <View style={styles.field}>
            <Text style={[styles.label, isDark && styles.darkLabel]}>
              Organisation Unit No <Text style={[styles.required, isDark && styles.darkRequired]}>*</Text>
              {formData.orgUnitNo && selectedHospital && formData.orgUnitName && (
                <Text style={[styles.autoFilledIndicator, isDark && styles.darkAutoFilledIndicator]}>
                  {' '}(Auto-filled)
                </Text>
              )}
            </Text>
            <TextInput
              style={[
                styles.input,
                isDark && styles.darkInput,
                !isEditing && styles.disabledInput,
                !isEditing && isDark && styles.darkDisabledInput,
                (formData.orgUnitNo && selectedHospital && formData.orgUnitName) && styles.autoFilledInput,
                (formData.orgUnitNo && selectedHospital && formData.orgUnitName) && isDark && styles.darkAutoFilledInput,
              ]}
              value={formData.orgUnitNo || ''}
              onChangeText={(value) => updateField('orgUnitNo', value)}
              placeholder={selectedHospital && formData.orgUnitName ? 'Auto-filled from hospital and department' : 'Enter org unit number'}
              placeholderTextColor={isDark ? '#666' : '#999'}
              editable={isEditing && !(formData.orgUnitNo && selectedHospital && formData.orgUnitName)}
            />
          </View>
          {renderField('Service Enquiry Number', 'serviceEnquiryNumber', 'Optional')}
        </View>

        {/* Delegate Details */}
        <View style={[styles.section, isDark && styles.darkCard]}>
          <Text style={[styles.sectionTitle, isDark && styles.darkSectionTitle]}>
            Delegate Details
            {isDelegateAutoFilled && (
              <Text style={[styles.autoFilledIndicator, isDark && styles.darkAutoFilledIndicator]}>
                {' '}(Auto-filled)
              </Text>
            )}
          </Text>
          
          <View style={styles.field}>
            <Text style={[styles.label, isDark && styles.darkLabel]}>
              Delegate Name <Text style={[styles.required, isDark && styles.darkRequired]}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                isDark && styles.darkInput,
                !isEditing && styles.disabledInput,
                !isEditing && isDark && styles.darkDisabledInput,
                isDelegateAutoFilled && styles.autoFilledInput,
                isDelegateAutoFilled && isDark && styles.darkAutoFilledInput,
              ]}
              value={formData.delegateName || ''}
              onChangeText={(value) => {
                updateField('delegateName', value);
                setIsDelegateAutoFilled(false); // Clear auto-fill indicator when manually edited
              }}
              placeholder="Enter delegate name"
              placeholderTextColor={isDark ? '#666' : '#999'}
              editable={isEditing}
            />
          </View>
          
          <View style={styles.field}>
            <Text style={[styles.label, isDark && styles.darkLabel]}>
              Delegate Position <Text style={[styles.required, isDark && styles.darkRequired]}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                isDark && styles.darkInput,
                !isEditing && styles.disabledInput,
                !isEditing && isDark && styles.darkDisabledInput,
                isDelegateAutoFilled && styles.autoFilledInput,
                isDelegateAutoFilled && isDark && styles.darkAutoFilledInput,
              ]}
              value={formData.delegatePosition || ''}
              onChangeText={(value) => {
                updateField('delegatePosition', value);
                setIsDelegateAutoFilled(false); // Clear auto-fill indicator when manually edited
              }}
              placeholder="Enter delegate position"
              placeholderTextColor={isDark ? '#666' : '#999'}
              editable={isEditing}
            />
          </View>
          
          {renderField('Area Code', 'delegateAreaCode', '(07)', true)}
          
          <View style={styles.field}>
            <Text style={[styles.label, isDark && styles.darkLabel]}>
              Phone Number <Text style={[styles.required, isDark && styles.darkRequired]}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                isDark && styles.darkInput,
                !isEditing && styles.disabledInput,
                !isEditing && isDark && styles.darkDisabledInput,
                isDelegateAutoFilled && styles.autoFilledInput,
                isDelegateAutoFilled && isDark && styles.darkAutoFilledInput,
              ]}
              value={formData.delegatePhone || ''}
              onChangeText={(value) => {
                updateField('delegatePhone', value);
                setIsDelegateAutoFilled(false); // Clear auto-fill indicator when manually edited
              }}
              placeholder="Enter phone number"
              placeholderTextColor={isDark ? '#666' : '#999'}
              editable={isEditing}
            />
          </View>
        </View>

        {/* Settings */}
        <View style={[styles.section, isDark && styles.darkCard]}>
          <Text style={[styles.sectionTitle, isDark && styles.darkSectionTitle]}>
            Settings
          </Text>
          
          <TouchableOpacity
            style={[styles.settingRow, isDark && styles.darkSettingRow]}
            onPress={() => router.push('/(tabs)/settings')}
          >
            <Text style={[styles.settingLabel, isDark && styles.darkSettingLabel]}>
              Email Settings
            </Text>
            <Text style={[styles.settingValue, isDark && styles.darkSettingValue]}>
              Customize email template →
            </Text>
          </TouchableOpacity>
          
          <View style={[styles.settingRow, isDark && styles.darkSettingRow]}>
            <Text style={[styles.settingLabel, isDark && styles.darkSettingLabel]}>
              Notifications
            </Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={notificationsEnabled ? '#f5dd4b' : '#f4f3f4'}
            />
          </View>
          
          <View style={[styles.settingRow, isDark && styles.darkSettingRow]}>
            <Text style={[styles.settingLabel, isDark && styles.darkSettingLabel]}>
              Timezone
            </Text>
            <Text style={[styles.settingValue, isDark && styles.darkSettingValue]}>
              Australia/Brisbane
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {isEditing ? (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, isDark && styles.darkCancelButton]}
                onPress={handleCancel}
              >
                <Text style={[styles.cancelButtonText, isDark && styles.darkCancelButtonText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton, isDark && styles.darkSaveButton]}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.button, styles.editButton, isDark && styles.darkEditButton]}
                onPress={() => setIsEditing(true)}
              >
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.clearDataButton, isDark && styles.darkClearDataButton]}
                onPress={() => router.push('/clear-data')}
              >
                <Text style={styles.clearDataButtonText}>Clear Test Data</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
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
  content: {
    padding: 16,
  },
  header: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  darkCard: {
    backgroundColor: '#1c1c1e',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  darkText: {
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#ff4444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  darkInput: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
    color: '#fff',
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  settingValue: {
    fontSize: 14,
    color: '#666',
  },
  actions: {
    marginTop: 16,
    marginBottom: 32,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  clearDataButton: {
    backgroundColor: '#ff3b30',
    marginTop: 12,
  },
  clearDataButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Enhanced dark mode styles
  darkSubtitle: {
    color: '#999',
  },
  darkSectionTitle: {
    color: '#fff',
  },
  darkLabel: {
    color: '#fff',
  },
  darkRequired: {
    color: '#ff6b6b',
  },
  darkDisabledInput: {
    backgroundColor: '#2c2c2e',
    color: '#999',
  },
  darkSettingRow: {
    borderBottomColor: '#333',
  },
  darkSettingLabel: {
    color: '#fff',
  },
  darkSettingValue: {
    color: '#999',
  },
  darkEditButton: {
    backgroundColor: '#007AFF',
  },
  darkSaveButton: {
    backgroundColor: '#4CAF50',
  },
  darkCancelButton: {
    backgroundColor: '#2c2c2e',
    borderColor: '#48484a',
  },
  darkCancelButtonText: {
    color: '#fff',
  },
  darkClearDataButton: {
    backgroundColor: '#ff3b30',
  },
  autoFilledIndicator: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  darkAutoFilledIndicator: {
    color: '#81C784',
  },
  autoFilledInput: {
    backgroundColor: '#f0f8f0',
    borderColor: '#4CAF50',
  },
  darkAutoFilledInput: {
    backgroundColor: '#1b2e1b',
    borderColor: '#81C784',
  },
});
