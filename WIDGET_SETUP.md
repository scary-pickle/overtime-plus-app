# Widget Setup Guide

This document provides instructions for setting up home screen widgets for iOS and Android.

## Overview

The widgets allow users to start and end shifts directly from their home screen. Widgets display the current shift status and provide quick action buttons.

## iOS Widget Setup

### Prerequisites

1. **App Groups**: You need to enable App Groups capability for both the main app and the widget extension.

### Steps

1. **Open Xcode Project**
   ```bash
   cd ios
   open Overtime.xcworkspace
   ```

2. **Create Widget Extension Target**
   - In Xcode, go to File → New → Target
   - Select "Widget Extension"
   - Name it "OvertimeWidgetExtension"
   - Bundle Identifier: `com.overtimeplus.app.OvertimeWidgetExtension`
   - Language: Swift
   - Uncheck "Include Configuration Intent" (we're using static configuration)

3. **Add Widget Files**
   - Copy the files from `ios/Overtime/OvertimeWidgetExtension/` to your new widget extension target
   - Add `OvertimeWidget.swift` and `OvertimeWidgetBundle.swift` to the widget target
   - Add `Info.plist` to the widget target

4. **Configure App Groups**
   - Select the main app target → Signing & Capabilities
   - Click "+ Capability" → Add "App Groups"
   - Create/select group: `group.com.overtimeplus.app`
   - Repeat for the widget extension target

5. **Update Info.plist**
   - In the widget extension's Info.plist, ensure it's configured correctly
   - The widget should have the correct NSExtension configuration

6. **Native Module for Status Updates** (Required)
   - You'll need to create a native module to update widget status from React Native
   - The module should write to `UserDefaults(suiteName: "group.com.overtimeplus.app")`
   - See `lib/widget/widgetStatusUpdater.ts` for the React Native side

### iOS Widget Files Structure

```
ios/
  Overtime/
    OvertimeWidgetExtension/
      OvertimeWidget.swift        # Main widget implementation
      OvertimeWidgetBundle.swift  # Widget bundle
      Info.plist                  # Widget configuration
```

## Android Widget Setup

### Prerequisites

1. Android Studio for building
2. Android SDK (API level 21+)

### Steps

1. **Add Widget Receiver to AndroidManifest.xml**
   - Open `android/app/src/main/AndroidManifest.xml`
   - Add the widget receiver inside `<application>`:
   ```xml
   <receiver
       android:name=".widget.OvertimeWidgetProvider"
       android:exported="true">
       <intent-filter>
           <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
       </intent-filter>
       <meta-data
           android:name="android.appwidget.provider"
           android:resource="@xml/overtime_widget_info" />
   </receiver>
   
   <receiver
       android:name=".widget.OvertimeWidgetReceiver"
       android:exported="true">
       <intent-filter>
           <action android:name="com.overtimeplus.WIDGET_ACTION_START_SHIFT" />
           <action android:name="com.overtimeplus.WIDGET_ACTION_END_SHIFT" />
       </intent-filter>
   </receiver>
   ```

2. **Add String Resources**
   - Ensure `android/app/src/main/res/values/strings.xml` exists with widget strings

3. **Create Preview Image** (Optional)
   - Create `android/app/src/main/res/drawable/widget_preview.png`
   - Recommended size: 320x320px

4. **Native Module for Status Updates** (Required)
   - You'll need to create a native module to update widget status from React Native
   - The module should write to `SharedPreferences` with key "overtime_prefs"
   - See `lib/widget/widgetStatusUpdater.ts` for the React Native side

### Android Widget Files Structure

```
android/
  app/
    src/
      main/
        java/
          com/
            overtimeplus/
              widget/
                OvertimeWidgetProvider.kt  # Widget provider
        res/
          layout/
            overtime_widget.xml            # Widget layout
          xml/
            overtime_widget_info.xml       # Widget configuration
          values/
            strings.xml                     # String resources
          drawable/
            widget_status_indicator.xml     # Status indicator drawable
```

## Deep Linking Configuration

The widgets use deep links to open the app:
- Start Shift: `overtime-plus://widget/start-shift`
- End Shift: `overtime-plus://widget/end-shift`

These links are already configured in `app.config.ts` with scheme `overtime-plus`.

## Testing

### iOS Testing

1. Build the app with widget extension:
   ```bash
   npx expo run:ios
   ```

2. Long press on home screen
3. Tap "+" button
4. Search for "Overtime+"
5. Select widget size and add to home screen

### Android Testing

1. Build the app:
   ```bash
   npx expo run:android
   ```

2. Long press on home screen
3. Select "Widgets"
4. Find "Overtime+"
5. Drag to home screen

## Widget Status Updates

Widgets update their status automatically:
- iOS: Updates every ~15 minutes (WidgetKit timeline)
- Android: Updates every 15 minutes (configured in widget info)

To manually trigger an update:
- iOS: The widget will refresh when the app updates the App Group
- Android: Send a broadcast with action `android.appwidget.action.APPWIDGET_UPDATE`

## Troubleshooting

### iOS Widget Not Showing

1. Ensure App Groups are configured for both targets
2. Check widget extension bundle identifier matches Info.plist
3. Verify widget files are added to the widget extension target (not just main app)

### Android Widget Not Showing

1. Check AndroidManifest.xml has widget receiver registered
2. Verify widget_info.xml exists and is valid
3. Check widget layout XML is correct

### Widget Status Not Updating

1. Ensure native module is created to bridge React Native to native storage
2. For iOS: Check App Group identifier matches (`group.com.overtimeplus.app`)
3. For Android: Verify SharedPreferences key matches (`overtime_prefs`)

## Next Steps

1. Create native modules to bridge widget status updates from React Native
2. Test widgets on physical devices (simulators have limited widget support)
3. Add widget configuration UI in the app settings
4. Consider adding lock screen widgets for iOS 16+







