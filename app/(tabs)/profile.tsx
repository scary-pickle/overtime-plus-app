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
  Switch,
  Animated,
  Keyboard,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '../../lib/state/profileStore';
import { EmptyState } from '../../components/EmptyState';
import { DepartmentDropdown } from '../../components/DepartmentDropdown';
import { HospitalDropdown } from '../../components/HospitalDropdown';
import { getDepartmentsForHospital, getHospitalById, QUEENSLAND_HOSPITALS, getDelegateForDepartment } from '../../lib/data/hospitalDepartments';
import { Profile } from '../../types';
import { profileStorage } from '../../lib/storage/profile';
import { useAuthStore } from '../../lib/state/authStore';
import { useOnboardingStore } from '../../lib/state/onboardingStore';
import { useSyncStore } from '../../lib/state/syncStore';
import { useSubscriptionStore } from '../../lib/state/subscriptionStore';
import { getManageSubscriptionUrl } from '../../lib/utils/subscription';

const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

const subscriptionStatusCopy = (reason: string): { title: string; detail: string } => {
  switch (reason) {
    case 'trial':
      return { title: 'Trial Active', detail: 'Enjoy all features until your trial expires.' };
    case 'legacy-free':
      return { title: 'Legacy Access', detail: 'You have temporary access during the rollout.' };
    case 'grace':
      return { title: 'Grace Period', detail: 'Exports remain available for 7 days after expiry.' };
    case 'active':
    case 'customer-entitled':
      return { title: 'Subscription Active', detail: 'Billing is current. Manage anytime.' };
    case 'paywall-disabled':
      return { title: 'Paywall Disabled', detail: 'Subscriptions are not enforced in this build.' };
    default:
      return { title: 'Subscription Required', detail: 'Start a trial or subscribe to keep access.' };
  }
};

function SubscriptionStatusCard({ isDark }: { isDark: boolean }) {
  const router = useRouter();
  const access = useSubscriptionStore((state) => state.access);
  const snapshot = useSubscriptionStore((state) => state.snapshot);
  const trialEligible = useSubscriptionStore((state) => state.isTrialEligible());
  const trialDaysRemaining = useSubscriptionStore((state) => state.trialDaysRemaining());
  const graceDaysRemaining = useSubscriptionStore((state) => state.graceDaysRemaining());
  const refreshSubscription = useSubscriptionStore((state) => state.refresh);
  const refreshing = useSubscriptionStore((state) => state.refreshing);
  const shouldShowPaywall = useSubscriptionStore((state) => state.access.shouldShowPaywall);

  const manageLabel = Platform.OS === 'ios' ? 'Manage in App Store' : 'Manage in Play Store';

  const handleManage = () => {
    const url = getManageSubscriptionUrl(Platform.OS === 'ios' ? 'ios' : 'android');
    Linking.openURL(url).catch(() => {
      Alert.alert('Manage Subscription', 'Unable to open subscription settings.');
    });
  };

  const copy = subscriptionStatusCopy(access.reason);

  return (
    <View style={[styles.subscriptionCard, isDark && styles.darkCard]}>
      <View style={styles.subscriptionHeader}>
        <Ionicons name="card-outline" size={20} color={isDark ? '#fff' : '#111'} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={[styles.subscriptionTitle, isDark && styles.darkSectionTitle]}>{copy.title}</Text>
          <Text style={[styles.subscriptionDetail, isDark && styles.darkSubtitle]}>{copy.detail}</Text>
        </View>
      </View>
      {trialEligible && (
        <Text style={[styles.subscriptionBadge, isDark && styles.darkSubscriptionBadge]}>
          Eligible for 1-month free trial
        </Text>
      )}
      {typeof trialDaysRemaining === 'number' && access.reason === 'trial' && (
        <Text style={[styles.subscriptionMeta, isDark && styles.darkSubtitle]}>
          Trial ends in {trialDaysRemaining} day{trialDaysRemaining === 1 ? '' : 's'}.
        </Text>
      )}
      {typeof graceDaysRemaining === 'number' && access.reason === 'grace' && (
        <Text style={[styles.subscriptionMeta, isDark && styles.darkSubtitle]}>
          Grace period ends in {graceDaysRemaining} day{graceDaysRemaining === 1 ? '' : 's'}.
        </Text>
      )}
      {snapshot?.subscriptionExpiresAt && (
        <Text style={[styles.subscriptionMeta, isDark && styles.darkSubtitle]}>
          Next renewal: {new Date(snapshot.subscriptionExpiresAt).toLocaleDateString()}
        </Text>
      )}
      {snapshot?.legacyFreeAccess && (
        <Text style={[styles.subscriptionMeta, styles.subscriptionLegacy]}>
          Legacy access enabled until you accept the paywall.
        </Text>
      )}
      <View style={styles.subscriptionButtons}>
        <TouchableOpacity
          style={[styles.subscriptionPrimaryButton, shouldShowPaywall && styles.subscriptionCTA]}
          onPress={() => router.push('/subscription/paywall')}
          activeOpacity={0.85}
        >
          <Text style={styles.subscriptionPrimaryButtonText}>
            {shouldShowPaywall ? 'Unlock Access' : 'View Paywall'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subscriptionSecondaryButton, isDark && styles.darkSecondaryButton]}
          onPress={handleManage}
          activeOpacity={0.85}
        >
          <Text style={[styles.subscriptionSecondaryButtonText, isDark && styles.darkText]}>
            {manageLabel}
          </Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.subscriptionRefresh}
        onPress={() => refreshSubscription()}
        disabled={refreshing}
      >
        {refreshing ? (
          <Text style={styles.subscriptionRefreshText}>Refreshing…</Text>
        ) : (
          <Text style={styles.subscriptionRefreshText}>Refresh subscription status</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
// Sync Status Indicator Component
function SyncStatusIndicator({ isDark }: { isDark: boolean }) {
  const { status, lastSyncTime, pendingOperations, error, checkSyncStatus, triggerFullSync } = useSyncStore();
  const { user } = useAuthStore();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  React.useEffect(() => {
    if (user?.id) {
      checkSyncStatus();
      // Check sync status every 30 seconds
      const interval = setInterval(() => {
        checkSyncStatus();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.id, checkSyncStatus]);

  const handleSync = async () => {
    if (!user?.id) return;
    setIsRefreshing(true);
    try {
      await triggerFullSync(user.id);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'synced':
        return 'checkmark-circle';
      case 'syncing':
        return 'sync';
      case 'error':
        return 'alert-circle';
      case 'offline':
        return 'cloud-offline';
      case 'pending':
        return 'time';
      default:
        return 'help-circle';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'synced':
        return '#4CAF50';
      case 'syncing':
        return '#2196F3';
      case 'error':
        return '#f44336';
      case 'offline':
        return '#ff9800';
      case 'pending':
        return '#ff9800';
      default:
        return isDark ? '#999' : '#666';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'synced':
        return 'Synced';
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return error || 'Sync Error';
      case 'offline':
        return 'Offline';
      case 'pending':
        return `Pending (${pendingOperations})`;
      default:
        return 'Unknown';
    }
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return null;
    const lastSync = new Date(lastSyncTime);
    const now = new Date();
    const diffMs = now.getTime() - lastSync.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <View style={[styles.settingRow, isDark && styles.darkSettingRow]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Ionicons 
            name={getStatusIcon() as any} 
            size={18} 
            color={getStatusColor()} 
            style={{ marginRight: 8 }}
          />
          <Text style={[styles.settingLabel, isDark && styles.darkSettingLabel]}>
            Sync Status
          </Text>
        </View>
        <Text style={[styles.settingValue, isDark && styles.darkSettingValue, { marginTop: 4 }]}>
          {getStatusText()}
        </Text>
        {lastSyncTime && status === 'synced' && (
          <Text style={[styles.settingValue, isDark && styles.darkSettingValue, { fontSize: 12, marginTop: 2, opacity: 0.7 }]}>
            Last synced: {formatLastSync()}
          </Text>
        )}
      </View>
      <TouchableOpacity
        onPress={handleSync}
        disabled={isRefreshing || status === 'syncing'}
        style={[
          styles.syncButton,
          (isRefreshing || status === 'syncing') && styles.syncButtonDisabled,
          isDark && styles.darkSyncButton,
        ]}
      >
        <Ionicons 
          name={status === 'syncing' ? 'sync' : 'refresh'} 
          size={18} 
          color={isDark ? '#fff' : '#2196F3'} 
        />
      </TouchableOpacity>
    </View>
  );
}

// Separate component file would be better, but defining here for now
// This component uses local state to prevent keyboard dismissal
function FieldInputUncontrolled({
  label,
  placeholder,
  required = false,
  initialValue,
  onChangeText,
  isDark,
  isEditing,
  fieldKey,
}: {
  label: string;
  placeholder: string;
  required?: boolean;
  initialValue: string;
  onChangeText: (value: string) => void;
  isDark: boolean;
  isEditing: boolean;
  fieldKey: string;
}) {
  const [localValue, setLocalValue] = useState(initialValue);
  const isFirstRender = useRef(true);
  const renderCount = useRef(0);
  
  renderCount.current += 1;
  devLog(`[FieldInput-${fieldKey}] Render #${renderCount.current}`, {
    localValue,
    initialValue,
    isEditing,
  });

  // Update local value when initial value changes from parent (but not on first render during typing)
  useEffect(() => {
    devLog(`[FieldInput-${fieldKey}] useEffect triggered`, {
      isFirstRender: isFirstRender.current,
      initialValue,
      localValue,
    });
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setLocalValue(initialValue);
  }, [initialValue, fieldKey, localValue]);

  const handleChange = (text: string) => {
    devLog(`[FieldInput-${fieldKey}] handleChange called`, { text });
    setLocalValue(text);
    onChangeText(text);
  };

  const fieldStyles = StyleSheet.create({
    field: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#333' },
    darkLabel: { color: '#fff' },
    required: { color: '#ff4444' },
    darkRequired: { color: '#ff6666' },
    input: {
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: '#333',
    },
    darkInput: {
      backgroundColor: '#2c2c2c',
      borderColor: '#444',
      color: '#fff',
    },
    disabledInput: {
      backgroundColor: '#f5f5f5',
      color: '#666',
    },
    darkDisabledInput: {
      backgroundColor: '#1a1a1a',
      color: '#888',
    },
  });

  return (
    <View style={fieldStyles.field}>
      <Text style={[fieldStyles.label, isDark && fieldStyles.darkLabel]}>
        {label}
        {required && <Text style={[fieldStyles.required, isDark && fieldStyles.darkRequired]}>*</Text>}
      </Text>
      <TextInput
        style={[
          fieldStyles.input,
          isDark && fieldStyles.darkInput,
          !isEditing && fieldStyles.disabledInput,
          !isEditing && isDark && fieldStyles.darkDisabledInput,
        ]}
        value={localValue}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={isDark ? '#666' : '#999'}
        editable={isEditing}
        blurOnSubmit={false}
        returnKeyType="next"
      />
    </View>
  );
}

const FieldInput = React.memo(FieldInputUncontrolled, (prevProps, nextProps) => {
  const shouldSkipRender = 
    prevProps.fieldKey === nextProps.fieldKey &&
    prevProps.initialValue === nextProps.initialValue &&
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.isDark === nextProps.isDark &&
    prevProps.label === nextProps.label &&
    prevProps.placeholder === nextProps.placeholder &&
    prevProps.required === nextProps.required &&
    prevProps.onChangeText === nextProps.onChangeText;
  
  devLog(`[FieldInput-${nextProps.fieldKey}] memo comparison`, {
    shouldSkipRender,
    initialValueChanged: prevProps.initialValue !== nextProps.initialValue,
    isEditingChanged: prevProps.isEditing !== nextProps.isEditing,
    isDarkChanged: prevProps.isDark !== nextProps.isDark,
    onChangeTextChanged: prevProps.onChangeText !== nextProps.onChangeText,
  });
  
  return shouldSkipRender;
});

// Collapsible Section Component - moved outside ProfileScreen to prevent recreation
interface CollapsibleSectionProps {
  sectionKey: string;
  title: string;
  children: React.ReactNode;
  subtitle?: string;
  badge?: React.ReactNode;
  onEdit?: () => void;
  showEdit?: boolean;
  isDark: boolean;
  isExpanded: boolean;
  isEditing: boolean;
  animationValue: Animated.Value;
  onToggle: (sectionKey: string, animationValue: Animated.Value) => void;
}

const CollapsibleSection = React.memo(({
  sectionKey,
  title,
  children,
  subtitle,
  badge,
  onEdit,
  showEdit = true,
  isDark,
  isExpanded,
  isEditing,
  animationValue,
  onToggle,
}: CollapsibleSectionProps) => {
  const rotateInterpolate = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  
  const maxHeight = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2000],
  });

  return (
    <View style={[styles.section, isDark && styles.darkCard]}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => onToggle(sectionKey, animationValue)}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeaderLeft}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, isDark && styles.darkSectionTitle]}>
              {title}
            </Text>
            {badge && badge}
          </View>
          {subtitle && (
            <Text style={[styles.sectionSubtitle, isDark && styles.darkSubtitle]}>
              {subtitle}
            </Text>
          )}
        </View>
        <View style={styles.sectionHeaderRight}>
          {showEdit && onEdit && (
            <TouchableOpacity
              style={[styles.iconButton, isDark && styles.darkIconButton]}
              onPress={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={isEditing ? "checkmark-circle" : "create-outline"}
                size={22}
                color={isEditing ? (isDark ? "#4CAF50" : "#4CAF50") : (isDark ? "#007AFF" : "#007AFF")}
              />
            </TouchableOpacity>
          )}
          <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
            <Ionicons
              name="chevron-down"
              size={24}
              color={isDark ? "#fff" : "#333"}
            />
          </Animated.View>
        </View>
      </TouchableOpacity>
      
      <Animated.View style={{ maxHeight, overflow: 'hidden' }}>
        <View style={styles.sectionContent}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
});

export default function ProfileScreen() {
  const renderCount = useRef(0);
  renderCount.current += 1;
  
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Use selective subscriptions to prevent unnecessary re-renders
  const profile = useProfileStore((state) => state.profile);
  const saveProfile = useProfileStore((state) => state.saveProfile);
  const loadProfile = useProfileStore((state) => state.loadProfile);
  const { user } = useAuthStore(); // Get user for userId
  const { resetOnboarding } = useOnboardingStore();
  // Compute isComplete locally instead of from store to avoid re-renders
  const isComplete = profile ? profileStorage.isProfileComplete(profile) : false;
  const [formData, setFormData] = useState<Partial<Profile>>({});
  // Auto-enable edit mode if there's no profile (new user)
  const [isEditing, setIsEditing] = useState(() => !profile);
  
  devLog(`[ProfileScreen] Render #${renderCount.current}`, {
    isEditing,
    hasProfile: !!profile,
    formDataKeys: Object.keys(formData),
  });
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [selectedHospital, setSelectedHospital] = useState('');
  const [isDelegateAutoFilled, setIsDelegateAutoFilled] = useState(false);
  const [isSMO, setIsSMO] = useState(false);
  const [customHospitals, setCustomHospitals] = useState<string[]>([]);
  const [customDepartments, setCustomDepartments] = useState<string[]>([]);
  
  // Track if user is currently typing to prevent interrupting updates
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Section expand/collapse state - auto-expand first section if no profile
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const hasProfile = !!profile;
    return {
      employeeDetails: !hasProfile, // Auto-expand if no profile
      organisation: false,
      delegateDetails: false,
      account: false,
      settings: false,
      widgetSetup: false,
    };
  });
  
  // Animation values for each section - initialize with expanded state if no profile
  const hasProfileOnMount = !!profile;
  const employeeDetailsAnimation = useRef(new Animated.Value(hasProfileOnMount ? 0 : 1)).current;
  const organisationAnimation = useRef(new Animated.Value(0)).current;
  const delegateDetailsAnimation = useRef(new Animated.Value(0)).current;
  const accountAnimation = useRef(new Animated.Value(0)).current;
  const settingsAnimation = useRef(new Animated.Value(0)).current;
  const widgetSetupAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadProfile(user?.id);
  }, [loadProfile, user?.id]);

  // Refresh profile when screen gains focus (prevents stale completeness state)
  // But don't reload if we're currently editing to prevent keyboard dismissal
  useFocusEffect(
    React.useCallback(() => {
      // Only reload if not editing to prevent interrupting user input
      if (!isEditing) {
        loadProfile(user?.id);
      }
    }, [isEditing, user?.id]) // Include isEditing and user?.id to check if we should reload
  );

  // Only update formData from profile when NOT editing and NOT typing to prevent keyboard dismissal
  useEffect(() => {
    devLog(`[ProfileScreen] profile/isEditing useEffect`, {
      hasProfile: !!profile,
      isEditing,
      isTyping: isTypingRef.current,
    });
    if (profile && !isEditing && !isTypingRef.current) {
      devLog(`[ProfileScreen] Updating formData from profile`);
      setFormData(profile);
      setSelectedHospital(profile.location || '');
      setIsSMO(profile.isSMO || false);
    } else if (!profile) {
      // If no profile, enable edit mode automatically and expand first section
      if (!isEditing) {
        devLog(`[ProfileScreen] No profile found, enabling edit mode`);
        setIsEditing(true);
      }
      // Auto-expand first section if not already expanded
      setExpandedSections(prev => {
        if (prev.employeeDetails) return prev;
        // Sync animation value when expanding
        Animated.timing(employeeDetailsAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }).start();
        return {
          ...prev,
          employeeDetails: true,
        };
      });
    } else {
      devLog(`[ProfileScreen] Skipping formData update (editing or typing)`);
    }
    // Don't update while editing or typing - let the user's changes persist
  }, [profile, isEditing]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleSave = async () => {
    if (!formData.fullName || !formData.payrollNumber || !formData.email) {
      Alert.alert('Required Fields', 'Please fill in all required fields.');
      return;
    }

    // Validate pay level is required only when not SMO
    if (!isSMO && !formData.payLevel) {
      Alert.alert('Required Fields', 'Please fill in your pay level.');
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
      isSMO: isSMO,
    };

    devLog('Form data before saving:', {
      hasEmployeeInitial: !!formData.employeeInitial,
      employeeInitial: formData.employeeInitial
    });
    
    devLog('Profile data being saved:', {
      hasEmployeeInitial: !!formData.employeeInitial,
      employeeInitial: formData.employeeInitial,
      allFields: Object.keys(profileData)
    });

    try {
      await saveProfile(profileData, user?.id);
      setIsEditing(false);
      devLog('Profile saved successfully, profileData:', profileData);
      Alert.alert('Success', 'Profile saved successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData(profile);
      setIsEditing(false);
    } else {
      // If no profile, keep editing enabled but reset form
      setFormData({});
    }
  };

  const toggleSection = (sectionKey: string, animationValue: Animated.Value) => {
    const isExpanded = expandedSections[sectionKey];
    devLog(`[ProfileScreen] toggleSection called`, { sectionKey, isExpanded, willExpand: !isExpanded });
    const willExpand = !isExpanded;
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: willExpand,
    }));

    Animated.timing(animationValue, {
      toValue: willExpand ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };


  const getAnimationValue = (sectionKey: string): Animated.Value => {
    switch (sectionKey) {
      case 'employeeDetails':
        return employeeDetailsAnimation;
      case 'organisation':
        return organisationAnimation;
      case 'delegateDetails':
        return delegateDetailsAnimation;
      case 'settings':
        return settingsAnimation;
      case 'widgetSetup':
        return widgetSetupAnimation;
      default:
        return employeeDetailsAnimation;
    }
  };

  const generateEmployeeInitial = (fullName: string): string => {
    const names = fullName.trim().split(' ');
    if (names.length === 1) {
      return names[0].substring(0, 2).toUpperCase();
    }
    return names.map(name => name.charAt(0)).join('').toUpperCase().substring(0, 3);
  };

  const handleFullNameChange = React.useCallback((value: string) => {
    devLog(`[ProfileScreen] handleFullNameChange called`, { value });
    setFormData(prev => {
      const updated = { ...prev, fullName: value };
      // Auto-generate employee initial from full name
      if (value.trim()) {
        updated.employeeInitial = generateEmployeeInitial(value);
      }
      devLog(`[ProfileScreen] handleFullNameChange updating formData`, { updated });
      return updated;
    });
  }, []);

  // Use useCallback to stabilize the updateField function
  const updateField = React.useCallback((field: keyof Profile, value: string) => {
    devLog(`[ProfileScreen] updateField called`, { field, value });
    isTypingRef.current = true;
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set flag to false after user stops typing (300ms of no input)
    typingTimeoutRef.current = setTimeout(() => {
      devLog(`[ProfileScreen] typing timeout expired for field: ${field}`);
      isTypingRef.current = false;
    }, 300);
    
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      devLog(`[ProfileScreen] setFormData updating`, { field, value, newData });
      return newData;
    });
  }, []);

  const handleHospitalChange = (hospitalName: string) => {
    setSelectedHospital(hospitalName);
    setFormData(prev => ({ ...prev, location: hospitalName }));
    // Clear department, org unit, and delegate when hospital changes
    setFormData(prev => ({ ...prev, orgUnitName: '', orgUnitNo: '', delegateName: '', delegatePosition: '', delegatePhone: '' }));
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
          delegatePhone: delegateInfo.delegatePhone
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

  const fieldHandlers = React.useMemo(() => {
    devLog('[ProfileScreen] fieldHandlers being created');
    return {
      payrollNumber: (value: string) => updateField('payrollNumber', value),
      payLevel: (value: string) => updateField('payLevel', value),
      employeeInitial: (value: string) => updateField('employeeInitial', value),
      email: (value: string) => updateField('email', value),
      orgUnitNo: (value: string) => updateField('orgUnitNo', value),
      serviceEnquiryNumber: (value: string) => updateField('serviceEnquiryNumber', value),
      delegateAreaCode: (value: string) => updateField('delegateAreaCode', value),
    };
  }, [updateField]);

  // Calculate profile completion status - must be before early return
  const isProfileComplete = profile ? profileStorage.isProfileComplete(profile) : false;
  const missingFields = profile && !isProfileComplete ? profileStorage.getMissingFields(profile) : [];

  // Group missing fields by section - must be before early return
  const missingFieldsBySection = React.useMemo(() => {
    const grouped: Record<string, { field: keyof Profile; label: string; section: string }[]> = {};
    missingFields.forEach(field => {
      if (!grouped[field.section]) {
        grouped[field.section] = [];
      }
      grouped[field.section].push(field);
    });
    return grouped;
  }, [missingFields]);

  // Function to scroll to a section - must be before early return
  const scrollToSection = React.useCallback((sectionKey: string) => {
    // Expand the section
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: true,
    }));
    
    // Animate the section open
    const animationValue = getAnimationValue(sectionKey);
    Animated.timing(animationValue, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
    
    // Enter edit mode if not already editing
    if (!isEditing) {
      setIsEditing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  return (
    <ScrollView 
      style={[styles.container, isDark && styles.darkContainer]} 
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={[styles.title, isDark && styles.darkText]}>
            Profile
          </Text>
          <Text style={[styles.subtitle, isDark && styles.darkSubtitle]}>
            {isProfileComplete ? 'Complete' : 'Incomplete'}
          </Text>
        </View>

        <SubscriptionStatusCard isDark={isDark} />

        {/* Missing Fields Alert */}
        {!isProfileComplete && missingFields.length > 0 && (
          <View style={[styles.missingFieldsCard, isDark && styles.darkMissingFieldsCard]}>
            <View style={styles.missingFieldsHeader}>
              <Ionicons 
                name="alert-circle-outline" 
                size={20} 
                color={isDark ? "#ff6b6b" : "#ff4444"} 
              />
              <Text style={[styles.missingFieldsTitle, isDark && styles.darkMissingFieldsTitle]}>
                Missing Required Fields
              </Text>
            </View>
            <Text style={[styles.missingFieldsDescription, isDark && styles.darkMissingFieldsDescription]}>
              Please fill in the following fields to complete your profile:
            </Text>
            {Object.entries(missingFieldsBySection).map(([section, fields]) => (
              <View key={section} style={styles.missingFieldsGroup}>
                <TouchableOpacity
                  onPress={() => {
                    // Map section names to section keys
                    const sectionKeyMap: Record<string, string> = {
                      'Employee Details': 'employeeDetails',
                      'Organisation': 'organisation',
                      'Delegate Details': 'delegateDetails',
                      'Settings': 'settings',
                    };
                    const sectionKey = sectionKeyMap[section] || 'employeeDetails';
                    scrollToSection(sectionKey);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.missingFieldsSectionTitle, isDark && styles.darkMissingFieldsSectionTitle]}>
                    {section}
                  </Text>
                </TouchableOpacity>
                {fields.map((field, index) => (
                  <TouchableOpacity
                    key={field.field}
                    onPress={() => {
                      // Map section names to section keys
                      const sectionKeyMap: Record<string, string> = {
                        'Employee Details': 'employeeDetails',
                        'Organisation': 'organisation',
                        'Delegate Details': 'delegateDetails',
                        'Settings': 'settings',
                      };
                      const sectionKey = sectionKeyMap[section] || 'employeeDetails';
                      scrollToSection(sectionKey);
                    }}
                    activeOpacity={0.7}
                    style={[
                      styles.missingFieldItem,
                      index < fields.length - 1 && styles.missingFieldItemBorder,
                      isDark && styles.darkMissingFieldItem,
                      index < fields.length - 1 && isDark && styles.darkMissingFieldItemBorder,
                    ]}
                  >
                    <Ionicons 
                      name="ellipse-outline" 
                      size={12} 
                      color={isDark ? "#ff6b6b" : "#ff4444"} 
                      style={styles.missingFieldIcon}
                    />
                    <Text style={[styles.missingFieldLabel, isDark && styles.darkMissingFieldLabel]}>
                      {field.label}
                    </Text>
                    <Ionicons 
                      name="chevron-forward" 
                      size={16} 
                      color={isDark ? "#999" : "#666"} 
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <TouchableOpacity
              style={[styles.editProfileButton, isDark && styles.darkEditProfileButton]}
              onPress={() => setIsEditing(true)}
            >
              <Text style={styles.editProfileButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Employee Details */}
        <CollapsibleSection
          sectionKey="employeeDetails"
          title="Employee Details"
          subtitle={formData.fullName ? `${formData.fullName}` : 'Personal information'}
          onEdit={isEditing ? handleSave : () => setIsEditing(true)}
          showEdit={true}
          isDark={isDark}
          isExpanded={expandedSections.employeeDetails}
          isEditing={isEditing}
          animationValue={employeeDetailsAnimation}
          onToggle={toggleSection}
        >
          <FieldInput
            fieldKey="fullName"
            label="Full Name"
            placeholder="Enter your full name"
            required={true}
            initialValue={formData.fullName || ''}
            onChangeText={handleFullNameChange}
            isDark={isDark}
            isEditing={isEditing}
          />
          <FieldInput
            fieldKey="payrollNumber"
            label="Payroll Number"
            placeholder="Enter payroll number"
            required={true}
            initialValue={formData.payrollNumber || ''}
            onChangeText={fieldHandlers.payrollNumber}
            isDark={isDark}
            isEditing={isEditing}
          />
          
          {/* SMO Toggle */}
          <View style={styles.field}>
            <Text style={[styles.label, isDark && styles.darkLabel]}>
              Are you an SMO? <Text style={[styles.required, isDark && styles.darkRequired]}>*</Text>
            </Text>
            <View style={[
              styles.toggleContainer,
              isDark && styles.darkToggleContainer,
              !isEditing && styles.disabledToggleContainer,
              !isEditing && isDark && styles.darkDisabledToggleContainer,
            ]}>
              <Text style={[
                styles.toggleLabel,
                isDark && styles.darkToggleLabel,
                !isEditing && styles.disabledToggleLabel,
                !isEditing && isDark && styles.darkDisabledToggleLabel,
              ]}>
                {isSMO ? 'Yes' : 'No'}
              </Text>
              <Switch
                value={isSMO}
                onValueChange={(value) => {
                  setIsSMO(value);
                  // Clear pay level when switching to SMO
                  if (value) {
                    setFormData(prev => ({ ...prev, payLevel: '' }));
                  }
                }}
                trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
                thumbColor={isSMO ? '#fff' : '#f4f3f4'}
                disabled={!isEditing}
                style={styles.switch}
              />
            </View>
          </View>

          {/* Pay Level - only show when not SMO */}
          {!isSMO && (
            <FieldInput
              fieldKey="payLevel"
              label="Pay Level"
              placeholder="Enter pay level"
              required={true}
              initialValue={formData.payLevel || ''}
              onChangeText={fieldHandlers.payLevel}
              isDark={isDark}
              isEditing={isEditing}
            />
          )}
          
          <FieldInput
            fieldKey="employeeInitial"
            label="Employee Initial"
            placeholder="Auto-generated from full name"
            required={true}
            initialValue={formData.employeeInitial || ''}
            onChangeText={fieldHandlers.employeeInitial}
            isDark={isDark}
            isEditing={isEditing}
          />
          <FieldInput
            fieldKey="email"
            label="Email Address"
            placeholder="your.name@health.qld.gov.au"
            required={true}
            initialValue={formData.email || ''}
            onChangeText={fieldHandlers.email}
            isDark={isDark}
            isEditing={isEditing}
          />
        </CollapsibleSection>

        {/* Organisation Details */}
        <CollapsibleSection
          sectionKey="organisation"
          title="Organisation"
          subtitle={selectedHospital ? `${selectedHospital}` : 'Hospital and department details'}
          onEdit={isEditing ? handleSave : () => setIsEditing(true)}
          showEdit={true}
          isDark={isDark}
          isExpanded={expandedSections.organisation}
          isEditing={isEditing}
          animationValue={organisationAnimation}
          onToggle={toggleSection}
        >
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
              customHospitals={customHospitals}
              onCustomHospitalAdd={handleCustomHospitalAdd}
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
              customDepartments={customDepartments}
              onCustomDepartmentAdd={handleCustomDepartmentAdd}
            />
          </View>
          
          <FieldInput
            fieldKey="orgUnitNo"
            label="Organisation Unit No"
            placeholder="Enter org unit number"
            required={true}
            initialValue={formData.orgUnitNo || ''}
            onChangeText={fieldHandlers.orgUnitNo}
            isDark={isDark}
            isEditing={isEditing}
          />
          <FieldInput
            fieldKey="serviceEnquiryNumber"
            label="Service Enquiry Number"
            placeholder="Optional"
            required={false}
            initialValue={formData.serviceEnquiryNumber || ''}
            onChangeText={fieldHandlers.serviceEnquiryNumber}
            isDark={isDark}
            isEditing={isEditing}
          />
        </CollapsibleSection>

        {/* Delegate Details */}
        <CollapsibleSection
          sectionKey="delegateDetails"
          title="Delegate Details"
          subtitle={formData.delegateName ? `${formData.delegateName}` : 'Delegate contact information'}
          onEdit={isEditing ? handleSave : () => setIsEditing(true)}
          showEdit={true}
          badge={isDelegateAutoFilled ? (
            <Text style={[styles.autoFilledIndicator, isDark && styles.darkAutoFilledIndicator]}>
              {' '}(Auto-filled)
            </Text>
          ) : undefined}
          isDark={isDark}
          isExpanded={expandedSections.delegateDetails}
          isEditing={isEditing}
          animationValue={delegateDetailsAnimation}
          onToggle={toggleSection}
        >
          <FieldInput
            fieldKey="delegateName"
            label="Delegate Name"
            placeholder="Enter delegate name"
            required={true}
            initialValue={formData.delegateName || ''}
            onChangeText={(value) => {
              updateField('delegateName', value);
              setIsDelegateAutoFilled(false); // Clear auto-fill indicator when manually edited
            }}
            isDark={isDark}
            isEditing={isEditing}
          />
          
          <FieldInput
            fieldKey="delegatePosition"
            label="Delegate Position"
            placeholder="Enter delegate position"
            required={true}
            initialValue={formData.delegatePosition || ''}
            onChangeText={(value) => {
              updateField('delegatePosition', value);
              setIsDelegateAutoFilled(false); // Clear auto-fill indicator when manually edited
            }}
            isDark={isDark}
            isEditing={isEditing}
          />
          
          <FieldInput
            fieldKey="delegateAreaCode"
            label="Area Code"
            placeholder="(07)"
            required={true}
            initialValue={formData.delegateAreaCode || ''}
            onChangeText={fieldHandlers.delegateAreaCode}
            isDark={isDark}
            isEditing={isEditing}
          />
          
          <FieldInput
            fieldKey="delegatePhone"
            label="Phone Number"
            placeholder="Enter phone number"
            required={true}
            initialValue={formData.delegatePhone || ''}
            onChangeText={(value) => {
              updateField('delegatePhone', value);
              setIsDelegateAutoFilled(false); // Clear auto-fill indicator when manually edited
            }}
            isDark={isDark}
            isEditing={isEditing}
          />
        </CollapsibleSection>

        {/* Account Management */}
        <CollapsibleSection
          sectionKey="account"
          title="Account"
          subtitle="Sign in and account management"
          showEdit={false}
          isDark={isDark}
          isExpanded={expandedSections.account}
          isEditing={isEditing}
          animationValue={accountAnimation}
          onToggle={toggleSection}
        >
          {/* Email Address */}
          {user?.email && (
            <View style={[styles.settingRow, isDark && styles.darkSettingRow]}>
              <View>
                <Text style={[styles.settingLabel, isDark && styles.darkSettingLabel]}>
                  Email Address
                </Text>
                <Text style={[styles.settingValue, isDark && styles.darkSettingValue, { marginTop: 4 }]}>
                  {user.email}
                </Text>
              </View>
            </View>
          )}

          {/* Sync Status */}
          {user && (
            <SyncStatusIndicator isDark={isDark} />
          )}
          
          {/* Sign Out action */}
          <TouchableOpacity
            style={[styles.settingRow, isDark && styles.darkSettingRow]}
            onPress={async () => {
              Alert.alert(
                'Sign Out',
                'Are you sure you want to sign out?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await useAuthStore.getState().signOut();
                        router.replace('/auth/welcome');
                      } catch (e) {
                        Alert.alert('Error', 'Failed to sign out. Please try again.');
                      }
                    },
                  },
                ]
              );
            }}
          >
            <Text style={[styles.settingLabel, isDark && styles.darkSettingLabel, { color: '#dc2626' }]}>
              Sign Out
            </Text>
            <Ionicons name="log-out-outline" size={20} color="#dc2626" />
          </TouchableOpacity>
        </CollapsibleSection>

        {/* Settings */}
        <CollapsibleSection
          sectionKey="settings"
          title="Settings"
          subtitle="Email, notifications, and preferences"
          showEdit={false}
          isDark={isDark}
          isExpanded={expandedSections.settings}
          isEditing={isEditing}
          animationValue={settingsAnimation}
          onToggle={toggleSection}
        >
          <TouchableOpacity
            style={[styles.settingRowStacked, isDark && styles.darkSettingRow]}
            onPress={() => router.push('/email-settings')}
          >
            <View style={styles.settingLeft}>
              <Text style={[styles.settingLabel, isDark && styles.darkSettingLabel]}>
                Email Settings
              </Text>
              <Text style={[styles.settingDescription, isDark && styles.darkSettingDescription]}>
                Customize email template
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#999' : '#666'} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.settingRowStacked, isDark && styles.darkSettingRow]}
            onPress={() => router.push('/recently-deleted')}
          >
            <View style={styles.settingLeft}>
              <Text style={[styles.settingLabel, isDark && styles.darkSettingLabel]}>
                Recently Deleted
              </Text>
              <Text style={[styles.settingDescription, isDark && styles.darkSettingDescription]}>
                Restore or permanently delete
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#999' : '#666'} />
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
          
          <TouchableOpacity
            style={[styles.settingRowStacked, isDark && styles.darkSettingRow]}
            onPress={async () => {
              Alert.alert(
                'Reset Onboarding',
                'This will reset your onboarding status. You will need to complete onboarding again. This is useful for testing or if you want to see the onboarding flow again.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await resetOnboarding(user?.id);
                        Alert.alert('Success', 'Onboarding has been reset. Please restart the app to see the onboarding flow again.');
                      } catch (e) {
                        Alert.alert('Error', 'Failed to reset onboarding. Please try again.');
                      }
                    },
                  },
                ]
              );
            }}
          >
            <View style={styles.settingLeft}>
              <Text style={[styles.settingLabel, isDark && styles.darkSettingLabel]}>
                Reset Onboarding
              </Text>
              <Text style={[styles.settingDescription, isDark && styles.darkSettingDescription]}>
                Restart the welcome flow
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#999' : '#666'} />
          </TouchableOpacity>
        </CollapsibleSection>

        {/* Widget Setup */}
        <CollapsibleSection
          sectionKey="widgetSetup"
          title="Home Screen Widget"
          subtitle="Quick access to start or end shifts"
          showEdit={false}
          isDark={isDark}
          isExpanded={expandedSections.widgetSetup}
          isEditing={isEditing}
          animationValue={widgetSetupAnimation}
          onToggle={toggleSection}
        >
          <Text style={[styles.description, isDark && styles.darkText]}>
            Add the Overtime+ widget to your home screen to quickly start or end shifts.
          </Text>
          
          <View style={styles.widgetInstructions}>
            <Text style={[styles.instructionTitle, isDark && styles.darkText]}>
              iOS:
            </Text>
            <Text style={[styles.instructionText, isDark && styles.darkText]}>
              1. Long press on your home screen{'\n'}
              2. Tap the "+" button{'\n'}
              3. Search for "Overtime+"{'\n'}
              4. Select widget size and tap "Add Widget"
            </Text>
            
            <Text style={[styles.instructionTitle, isDark && styles.darkText]}>
              Android:
            </Text>
            <Text style={[styles.instructionText, isDark && styles.darkText]}>
              1. Long press on your home screen{'\n'}
              2. Select "Widgets"{'\n'}
              3. Find "Overtime+"{'\n'}
              4. Drag to your home screen
            </Text>
          </View>
        </CollapsibleSection>

        {/* Action Buttons */}
        {isEditing && (
          <View style={styles.actions}>
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
                <Text style={styles.saveButtonText}>Save All</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    paddingTop: 80,
  },
  headerContainer: {
    marginBottom: 16,
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
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  darkCard: {
    backgroundColor: '#1c1c1e',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
  },
  sectionHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  sectionContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  iconButton: {
    padding: 4,
  },
  darkIconButton: {
    // Additional styles if needed
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
  settingRowStacked: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  settingLeft: {
    flex: 1,
    gap: 4,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  settingDescription: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  darkSettingDescription: {
    color: '#666',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingValue: {
    fontSize: 14,
    color: '#666',
  },
  actions: {
    marginTop: 16,
    marginBottom: 32,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  smallPrimary: {
    backgroundColor: '#007AFF',
  },
  darkSmallPrimary: {
    backgroundColor: '#007AFF',
  },
  smallSave: {
    backgroundColor: '#4CAF50',
  },
  darkSmallSave: {
    backgroundColor: '#4CAF50',
  },
  smallPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  smallSaveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
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
  smoToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    minHeight: 48,
  },
  darkToggleContainer: {
    backgroundColor: '#2c2c2e',
    borderColor: '#333',
  },
  disabledToggleContainer: {
    backgroundColor: '#f5f5f5',
  },
  darkDisabledToggleContainer: {
    backgroundColor: '#2c2c2e',
  },
  toggleLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  darkToggleLabel: {
    color: '#fff',
  },
  disabledToggleLabel: {
    color: '#666',
  },
  darkDisabledToggleLabel: {
    color: '#999',
  },
  switch: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  widgetInstructions: {
    marginTop: 12,
    gap: 16,
  },
  instructionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  missingFieldsCard: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  darkMissingFieldsCard: {
    backgroundColor: '#2a2415',
    borderColor: '#ff9800',
  },
  missingFieldsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  missingFieldsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
  },
  darkMissingFieldsTitle: {
    color: '#ffab40',
  },
  missingFieldsDescription: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 12,
    lineHeight: 20,
  },
  darkMissingFieldsDescription: {
    color: '#ffab40',
  },
  missingFieldsGroup: {
    marginBottom: 12,
  },
  missingFieldsSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  darkMissingFieldsSectionTitle: {
    color: '#ffab40',
  },
  missingFieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 4,
    gap: 10,
  },
  missingFieldItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#ffc107',
  },
  darkMissingFieldItem: {
    // Additional dark mode styles if needed
  },
  darkMissingFieldItemBorder: {
    borderBottomColor: '#ff9800',
  },
  missingFieldIcon: {
    marginRight: 4,
  },
  missingFieldLabel: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
    fontWeight: '500',
  },
  darkMissingFieldLabel: {
    color: '#ffab40',
  },
  editProfileButton: {
    backgroundColor: '#ffc107',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  darkEditProfileButton: {
    backgroundColor: '#ff9800',
  },
  editProfileButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
  syncButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  syncButtonDisabled: {
    opacity: 0.5,
  },
  darkSyncButton: {
    backgroundColor: 'transparent',
  },
  subscriptionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  subscriptionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  subscriptionDetail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  subscriptionBadge: {
    backgroundColor: '#E8F5E9',
    color: '#2e7d32',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  darkSubscriptionBadge: {
    backgroundColor: '#1b2e1b',
    color: '#81C784',
  },
  subscriptionMeta: {
    fontSize: 13,
    color: '#555',
    marginBottom: 4,
  },
  subscriptionLegacy: {
    color: '#ff9800',
    fontWeight: '600',
  },
  subscriptionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  subscriptionPrimaryButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  subscriptionCTA: {
    backgroundColor: '#00c853',
  },
  subscriptionPrimaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  subscriptionSecondaryButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  darkSecondaryButton: {
    borderColor: '#333',
    backgroundColor: '#1e1e1e',
  },
  subscriptionSecondaryButtonText: {
    fontWeight: '600',
    color: '#333',
  },
  subscriptionRefresh: {
    marginTop: 12,
    alignItems: 'center',
  },
  subscriptionRefreshText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '500',
  },
});
