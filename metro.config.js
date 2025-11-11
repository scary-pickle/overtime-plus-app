// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure PDF assets are properly resolved
if (!config.resolver.assetExts.includes('pdf')) {
  config.resolver.assetExts.push('pdf');
}

// Ensure source extensions are properly configured
if (!config.resolver.sourceExts.includes('ts')) {
  config.resolver.sourceExts.push('ts', 'tsx');
}

// ROOT CAUSE FIX: Custom server middleware to properly decode unstable_path
// Metro's server code doesn't decode unstable_path before using it as a filesystem path
// This middleware intercepts requests and properly decodes the path before Metro processes it
const originalEnhanceMiddleware = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    // Apply any existing middleware enhancement
    const enhancedMiddleware = originalEnhanceMiddleware 
      ? originalEnhanceMiddleware(middleware)
      : middleware;
    
    // Add our custom middleware to fix asset paths at the root cause
    return (req, res, next) => {
      // ROOT CAUSE FIX: Properly decode unstable_path before Metro processes it
      // This fixes the issue where Metro tries to use URL-encoded paths as filesystem paths
      if (req.url && req.url.includes('unstable_path')) {
        try {
          const url = new URL(req.url, 'http://localhost');
          const unstablePath = url.searchParams.get('unstable_path');
          
          if (unstablePath) {
            // Step 1: Decode the URL-encoded path (e.g., .%2Fassets%2Fpdf -> ./assets/pdf)
            let decodedPath = unstablePath;
            try {
              decodedPath = decodeURIComponent(unstablePath);
            } catch (e) {
              // If decoding fails, try manual fix for common cases
              decodedPath = unstablePath.replace(/%2F/g, '/').replace(/%20/g, ' ');
            }
            
            // Step 2: Remove leading ./ if present (Metro doesn't handle this well)
            // This is the root cause - paths starting with ./ get URL-encoded incorrectly
            if (decodedPath.startsWith('./')) {
              decodedPath = decodedPath.substring(2);
            }
            
            // Step 3: Ensure the path doesn't start with / (Metro expects relative paths)
            if (decodedPath.startsWith('/')) {
              decodedPath = decodedPath.substring(1);
            }
            
            // Step 4: Update the URL with the properly decoded and normalized path
            url.searchParams.set('unstable_path', decodedPath);
            req.url = url.pathname + (url.search ? '?' + url.searchParams.toString() : '');
            
            // Log the fix for debugging (can be removed later)
            // Note: These logs appear in Metro server console, not client logs
            if (unstablePath !== decodedPath) {
              console.log('[Metro Fix] Decoded unstable_path:', unstablePath, '->', decodedPath);
              // Also log to help with debugging
              console.log('[Metro Fix] Original URL:', req.url);
              console.log('[Metro Fix] Fixed URL:', url.toString());
            }
          }
        } catch (e) {
          // If URL parsing fails, continue with original URL
          console.warn('[Metro] Failed to fix asset path:', e);
        }
      }
      
      // Call the enhanced middleware
      return enhancedMiddleware(req, res, next);
    };
  },
};

// ROOT CAUSE FIX: Custom serializer to normalize asset paths during registration
// This prevents Metro from generating httpServerLocation with ./ prefix
// We'll use a custom serializer to post-process asset data
config.serializer = {
  ...config.serializer,
  customSerializer: config.serializer?.customSerializer,
  // Note: We can't easily override asset registration here, so the middleware fix above is the primary solution
};

module.exports = config;

