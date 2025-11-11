# Metro URL Encoding Issue - Root Cause Analysis

## Problem Summary
Metro is generating incorrectly encoded asset URLs with `unstable_path=.%2Fassets%2Fpdf/AVAC template horizontal.pdf` instead of `unstable_path=assets/pdf/AVAC template horizontal.pdf`.

## Root Cause Chain

### 1. Asset Registration (Metro/src/Assets.js:157-178)
When Metro processes an asset file, it calls `getAssetData()` which:
- Takes the `localPath` (e.g., `../../assets/pdf/AVAC template horizontal.pdf`)
- Calculates `assetUrlPath` using `publicPath` and `localPath`
- Sets `httpServerLocation: assetUrlPath` in the asset descriptor

**Key Code:**
```javascript
let assetUrlPath = localPath.startsWith("..")
  ? publicPath.replace(/\/$/, "") + "/" + _path.default.dirname(localPath)
  : _path.default.join(publicPath, _path.default.dirname(localPath));
assetUrlPath = (0, _pathUtils.normalizePathSeparatorsToPosix)(assetUrlPath);
```

**Issue:** When `localPath` starts with `..`, Metro constructs the path as:
- `publicPath + "/" + dirname(localPath)`
- For `../../assets/pdf/AVAC template horizontal.pdf`, this becomes `./assets/pdf`
- This path is stored as `httpServerLocation: "./assets/pdf"`

### 2. Asset URI Generation (Expo AssetSourceResolver.ts:15-25)
When `Asset.fromModule()` is called, it uses `resolveAssetSource()` which:
- Gets the asset metadata from the registry
- Creates an `AssetSourceResolver` instance
- Calls `assetServerURL()` which uses `getScaledAssetPath()`

**Key Code:**
```typescript
function getScaledAssetPath(asset: PackagerAsset | AssetMetadata): string {
  const scale = AssetSourceResolver.pickScale(asset.scales, PixelRatio.get());
  const scaleSuffix = scale === 1 ? '' : '@' + scale + 'x';
  const type = !asset.type ? '' : `.${asset.type}`;
  if (__DEV__) {
    return asset.httpServerLocation + '/' + asset.name + scaleSuffix + type;
  } else {
    return asset.httpServerLocation.replace(/\.\.\//g, '_') + '/' + asset.name + scaleSuffix + type;
  }
}
```

**Issue:** In development mode, it directly uses `asset.httpServerLocation` which is `"./assets/pdf"`, resulting in `"./assets/pdf/AVAC template horizontal.pdf"`.

### 3. URL Construction (Expo AssetSourceResolver.ts:63-70)
The `assetServerURL()` method constructs the URL:
```typescript
assetServerURL(): ResolvedAssetSource {
  const fromUrl = new URL(getScaledAssetPath(this.asset), this.serverUrl);
  fromUrl.searchParams.set('platform', Platform.OS);
  fromUrl.searchParams.set('hash', this.asset.hash);
  return this.fromSource(
    fromUrl.toString().replace(fromUrl.origin, '')
  );
}
```

**Issue:** When `getScaledAssetPath()` returns `"./assets/pdf/AVAC template horizontal.pdf"`, the `URL` constructor:
- Creates a URL with pathname `"./assets/pdf/AVAC template horizontal.pdf"`
- When this is used as a query parameter in `unstable_path`, it gets URL-encoded
- `./` becomes `.%2F` (`.` + URL-encoded `/`)
- Result: `unstable_path=.%2Fassets%2Fpdf/AVAC template horizontal.pdf`

### 4. Metro Server Processing (Metro/src/Server.js:411-424)
When Metro receives the request, it tries to extract the path:
```javascript
if (!assetPath && urlObj.searchParams.get("unstable_path")) {
  const [, actualPath, secondaryQuery] = (0, _nullthrows.default)(
    (urlObj.searchParams.get("unstable_path") || "").match(
      /^([^?]*)\??(.*)$/,
    ),
  );
  assetPath = actualPath;
}
```

**Issue:** Metro extracts `actualPath` as `.%2Fassets%2Fpdf/AVAC template horizontal.pdf` and tries to use it directly as a filesystem path, which fails because:
- It tries to read from `.%2Fassets%2Fpdf` (literal string, not decoded)
- This path doesn't exist on the filesystem
- Metro throws: `ENOENT: no such file or directory, scandir '/Users/.../.%2Fassets%2Fpdf'`

## Why This Happens

1. **Relative Path Handling:** Metro's `getAssetData()` function handles relative paths (`..`) by prepending `publicPath`, which results in paths starting with `./`.

2. **URL Encoding:** When the path `"./assets/pdf/..."` is used in a URL query parameter, the `./` gets URL-encoded to `.%2F`.

3. **No Decoding:** Metro's server code extracts the path from `unstable_path` but doesn't decode it before using it as a filesystem path.

## The Fix

Our current fix works around this by:
1. **Metro Middleware:** Intercepting requests and decoding the `unstable_path` parameter before Metro processes it
2. **Client-Side Fix:** Decoding the URL in the client code before making requests
3. **Fallback System:** Using multiple fallback methods to ensure the asset loads

However, this is a **workaround**, not a fix of the root cause.

## Proper Fix

The proper fix would be to:
1. **Fix Metro's asset registration** to not generate paths starting with `./`
2. **Fix Metro's server** to decode `unstable_path` before using it
3. **Fix Expo's AssetSourceResolver** to normalize paths before URL construction

## Production Impact

- **Development:** The issue occurs because Metro generates URLs with `unstable_path`
- **Production:** Assets are bundled, so Metro URLs aren't used - the issue shouldn't occur
- **Current Fix:** Works in both dev and production, but relies on workarounds

## Recommendations

1. **Short-term:** Keep the current workaround (it works)
2. **Long-term:** Report this as a bug to Metro/Expo and fix at the source
3. **Testing:** Test production builds to ensure assets load correctly without Metro URLs

