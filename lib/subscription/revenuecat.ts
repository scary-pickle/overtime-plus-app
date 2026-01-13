import { Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';
import { createScopedLogger } from '../utils/logger';
import { DEFAULT_SUBSCRIPTION_PRODUCTS } from '../utils/subscription';

// Type imports for TypeScript
type CustomerInfo = import('react-native-purchases').CustomerInfo;
type PurchasesOfferings = import('react-native-purchases').PurchasesOfferings;
type PurchasesPackage = import('react-native-purchases').PurchasesPackage;
type PurchasesOffering = import('react-native-purchases').PurchasesOffering;

type ConfigureResult = {
  configured: boolean;
  appUserId: string | null;
  reason?: string;
};

const logger = createScopedLogger('revenuecat');
let isConfigured = false;
let lastUserId: string | null = null;

const isSupportedPlatform = (): boolean => Platform.OS === 'ios' || Platform.OS === 'android';

// Check if native module is available before importing
const isNativeModuleAvailable = (): boolean => {
  if (!isSupportedPlatform()) {
    return false;
  }
  
  // Skip if running in Expo Go (native modules not available)
  try {
    const executionEnvironment = Constants.executionEnvironment;
    // Check if ExecutionEnvironment enum exists before comparing
    if (Constants.ExecutionEnvironment && executionEnvironment === Constants.ExecutionEnvironment.StoreClient) {
      // Expo Go - native modules not available
      return false;
    }
  } catch (error) {
    // Constants might not be available in all environments
    // Continue to check native module availability
  }
  
  // Check if NativeModules is available and if Purchases native module exists
  try {
    if (!NativeModules) {
      return false;
    }
    
    // The native module name varies by platform
    // Try common names for react-native-purchases
    const possibleNames = Platform.OS === 'ios' 
      ? ['RNPurchases', 'Purchases', 'RCPurchases'] 
      : ['RNPurchasesModule', 'PurchasesModule', 'RNPurchases', 'RCPurchases'];
    
    const hasModule = possibleNames.some(name => {
      try {
        return NativeModules[name] != null;
      } catch {
        return false;
      }
    });
    
    return hasModule;
  } catch (error) {
    return false;
  }
};

// Lazy import to avoid NativeEventEmitter errors when native module isn't available
let PurchasesModule: any = null;
let PurchasesTypes: any = null;
let moduleLoadAttempted = false;
let moduleLoadFailed = false;

const getPurchasesModule = async () => {
  if (PurchasesModule) return PurchasesModule;
  if (moduleLoadFailed) return null;
  
  try {
    if (!isSupportedPlatform()) {
      moduleLoadFailed = true;
      return null;
    }
    
    // Check if native module is available before attempting import
    if (!isNativeModuleAvailable()) {
      if (__DEV__ && !moduleLoadAttempted) {
        try {
          const env = Constants.executionEnvironment;
          const isExpoGo = Constants.ExecutionEnvironment && env === Constants.ExecutionEnvironment.StoreClient;
          logger.debug('RevenueCat native module not available', {
            executionEnvironment: env,
            isExpoGo,
          });
        } catch (e) {
          logger.debug('RevenueCat native module not available (could not check execution environment)');
        }
      }
      moduleLoadFailed = true;
      return null;
    }
    
    moduleLoadAttempted = true;
    
    // Use a promise wrapper to catch synchronous errors during module evaluation
    const importPromise = import('react-native-purchases');
    
    // Add a timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Import timeout')), 5000);
    });
    
    const module = await Promise.race([importPromise, timeoutPromise]) as any;
    PurchasesModule = module.default;
    PurchasesTypes = module;
    return PurchasesModule;
  } catch (error: any) {
    // Handle NativeEventEmitter errors gracefully
    const errorMessage = error?.message || String(error);
    if (
      errorMessage.includes('NativeEventEmitter') || 
      errorMessage.includes('requires a non-null argument') ||
      errorMessage.includes('Invariant Violation')
    ) {
      if (__DEV__ && !moduleLoadFailed) {
        logger.debug('RevenueCat native module not properly linked, skipping import', {
          error: errorMessage.substring(0, 100),
        });
      }
      moduleLoadFailed = true;
      return null;
    }
    
    if (__DEV__) {
      logger.debug('Failed to load react-native-purchases module', {
        error: errorMessage.substring(0, 200),
      });
    }
    moduleLoadFailed = true;
    return null;
  }
};

const getApiKeyForPlatform = (): string | null => {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || null;
  }
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || null;
  }
  return null;
};

const ensureConfigured = async (userId?: string | null): Promise<ConfigureResult> => {
  if (!isSupportedPlatform()) {
    return { configured: false, appUserId: null, reason: 'unsupported-platform' };
  }

  const apiKey = getApiKeyForPlatform();
  if (!apiKey) {
    if (__DEV__) {
      logger.debug('RevenueCat API key missing for platform', Platform.OS);
    }
    return { configured: false, appUserId: null, reason: 'missing-api-key' };
  }

  if (!isConfigured) {
    try {
      const Purchases = await getPurchasesModule();
      if (!Purchases) {
        return { configured: false, appUserId: null, reason: 'module-not-available' };
      }
      
      if (PurchasesTypes?.LOG_LEVEL) {
        Purchases.setLogLevel(__DEV__ ? PurchasesTypes.LOG_LEVEL.VERBOSE : PurchasesTypes.LOG_LEVEL.INFO);
      }
      Purchases.configure({ apiKey });
      isConfigured = true;
      logger.debug('RevenueCat configured');
    } catch (error) {
      logger.error('Failed to configure RevenueCat', error);
      return { configured: false, appUserId: null, reason: 'configure-failed' };
    }
  }

  if (userId && userId !== lastUserId) {
    try {
      const Purchases = await getPurchasesModule();
      if (!Purchases) {
        return { configured: false, appUserId: null, reason: 'module-not-available' };
      }
      
      const result = await Purchases.logIn(userId);
      lastUserId = result?.customerInfo?.originalAppUserId || userId;
      logger.debug('RevenueCat logged in', { userId: lastUserId?.substring(0, 6) });
    } catch (error) {
      logger.error('Failed to log in to RevenueCat', error);
    }
  }

  return { configured: isConfigured, appUserId: lastUserId };
};

const requireConfiguration = async (userId?: string | null): Promise<boolean> => {
  const result = await ensureConfigured(userId);
  return result.configured;
};

export const revenuecatClient = {
  isSupported: isSupportedPlatform(),

  async configure(userId?: string | null): Promise<ConfigureResult> {
    return ensureConfigured(userId);
  },

  async logOut(): Promise<void> {
    if (!isConfigured) {
      return;
    }
    try {
      const Purchases = await getPurchasesModule();
      if (!Purchases) return;
      
      await Purchases.logOut();
      lastUserId = null;
    } catch (error) {
      logger.error('RevenueCat logout failed', error);
    }
  },

  async getCustomerInfo(userId?: string | null): Promise<CustomerInfo | null> {
    if (!(await requireConfiguration(userId))) {
      return null;
    }
    try {
      const Purchases = await getPurchasesModule();
      if (!Purchases) return null;
      
      return await Purchases.getCustomerInfo();
    } catch (error) {
      logger.error('Failed to fetch RevenueCat customer info', error);
      return null;
    }
  },

  async getOfferings(userId?: string | null): Promise<PurchasesOfferings | null> {
    if (!(await requireConfiguration(userId))) {
      return null;
    }
    try {
      const Purchases = await getPurchasesModule();
      if (!Purchases) return null;
      
      return await Purchases.getOfferings();
    } catch (error: any) {
      // Check if this is a configuration error (expected during setup)
      const errorCode = error?.code || error?.userInfo?.readableErrorCode || error?.userInfo?.rc_root_error?.code;
      const errorMessage = error?.message || '';
      
      const isNoProductsError = 
        errorMessage.includes('no products registered') ||
        errorMessage.includes('no products set up');
      
      const isProductsNotFetchableError = 
        errorMessage.includes('could not be fetched from App Store Connect') ||
        errorMessage.includes('could not be fetched from') ||
        errorMessage.includes('StoreKit Configuration file');
      
      const isConfigurationError = 
        errorCode === 23 || 
        errorCode === 'CONFIGURATION_ERROR' ||
        isNoProductsError ||
        isProductsNotFetchableError;
      
      if (isConfigurationError) {
        // This is expected during initial setup - log as debug with helpful context
        if (isProductsNotFetchableError) {
          logger.debug('RevenueCat products cannot be fetched from App Store Connect', {
            message: errorMessage.substring(0, 150),
            hint: 'Products may not exist in App Store Connect yet, or StoreKit Configuration file needed for testing',
          });
        } else {
          logger.debug('RevenueCat offerings not configured yet - products need to be set up in dashboard', {
            message: errorMessage.substring(0, 100),
          });
        }
      } else {
        // Other errors should be logged as errors
        logger.error('Failed to fetch RevenueCat offerings', error);
      }
      return null;
    }
  },

  async restorePurchases(userId?: string | null): Promise<CustomerInfo | null> {
    if (!(await requireConfiguration(userId))) {
      return null;
    }
    try {
      const Purchases = await getPurchasesModule();
      if (!Purchases) return null;
      
      return await Purchases.restorePurchases();
    } catch (error) {
      logger.error('Failed to restore purchases', error);
      throw error;
    }
  },

  async purchasePackage(
    identifier: string,
    userId?: string | null
  ): Promise<CustomerInfo | null> {
    if (!(await requireConfiguration(userId))) {
      return null;
    }
    try {
      const Purchases = await getPurchasesModule();
      if (!Purchases) return null;
      
      const pkg = await findPackageByIdentifier(identifier, userId);
      if (!pkg) {
        throw new Error(`Package ${identifier} not found in offerings`);
      }
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return customerInfo;
    } catch (error) {
      logger.error('Failed to purchase package', error);
      throw error;
    }
  },

  async checkTrialEligibility(
    productIdentifiers: string[] = DEFAULT_SUBSCRIPTION_PRODUCTS,
    userId?: string | null
  ): Promise<Record<string, boolean>> {
    if (!productIdentifiers.length || !(await requireConfiguration(userId))) {
      return {};
    }
    try {
      const Purchases = await getPurchasesModule();
      if (!Purchases || !PurchasesTypes) return {};
      
      const results = await Purchases.checkTrialOrIntroductoryPriceEligibility(productIdentifiers);
      const eligibility: Record<string, boolean> = {};
      Object.entries(results || {}).forEach(([key, value]: [string, any]) => {
        eligibility[key] =
          value?.status === PurchasesTypes.INTRO_ELIGIBILITY_STATUS?.ELIGIBLE;
      });
      return eligibility;
    } catch (error) {
      logger.error('Failed to check trial eligibility', error);
      return {};
    }
  },
};

async function findPackageByIdentifier(
  identifier: string,
  userId?: string | null
): Promise<PurchasesPackage | null> {
  const offerings = await revenuecatClient.getOfferings(userId);
  if (!offerings) {
    return null;
  }

  const packages: PurchasesPackage[] = [];
  if (offerings.current) {
    offerings.current.availablePackages.forEach((pkg) => packages.push(pkg));
  }
  Object.values(offerings.all || {}).forEach((offering: PurchasesOffering) => {
    offering.availablePackages.forEach((pkg) => packages.push(pkg));
  });

  return (
    packages.find(
      (pkg) =>
        pkg.identifier === identifier ||
        pkg.product?.identifier === identifier ||
        pkg.product?.productIdentifier === identifier
    ) || null
  );
}
