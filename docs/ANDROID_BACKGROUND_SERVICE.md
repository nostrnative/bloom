# Android Background Service Implementation Guide

This document outlines the robust pattern for implementing persistent background services in Android applications, specifically optimized for servers, relays, or data-sync engines (like Rust/Tauri backends).

## 1. Manifest Configuration

The `AndroidManifest.xml` must define the service with the correct type and permissions. For apps acting as local servers or relays, `remoteMessaging` is the recommended type.

### Permissions
```xml
<!-- Required for any foreground service -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />

<!-- Specific to the type (Required for Android 14+) -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_REMOTE_MESSAGING" />

<!-- Required for the foreground notification (Android 13+) -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<!-- Required to keep CPU running when screen is off -->
<uses-permission android:name="android.permission.WAKE_LOCK" />

<!-- Required to start service on device boot -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

<!-- Optional: Helps prevent OS from killing the service during idle -->
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
```

### Service Definition
```xml
<service
    android:name=".YourService"
    android:enabled="true"
    android:exported="false"
    android:directBootAware="true"
    android:foregroundServiceType="remoteMessaging">
</service>

<receiver
    android:name=".BootReceiver"
    android:enabled="true"
    android:exported="false"
    android:directBootAware="true">
    <intent-filter>
        <action android:name="android.intent.action.BOOT_COMPLETED" />
    </intent-filter>
</receiver>
```

---

## 2. Robust Service Start Pattern (AlarmManager)

Starting a foreground service directly from a `BroadcastReceiver` or even `MainActivity` can sometimes be unreliable due to OS background restrictions. Using `AlarmManager` to schedule a start is a proven "kickstart" method.

```kotlin
fun startService(context: Context) {
    val intent = Intent(context, YourService::class.java)
    val pendingIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        PendingIntent.getForegroundService(
            context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    } else {
        PendingIntent.getService(
            context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    // Schedule a start 1 second in the future
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        alarmManager.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP, 
            System.currentTimeMillis() + 1000, 
            pendingIntent
        )
    } else {
        alarmManager.set(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 1000, pendingIntent)
    }
}
```

---

## 3. Foreground Service Implementation (Kotlin)

For Android 14 (API 34) and above, you **must** specify the service type in the `startForeground()` call.

```kotlin
override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val notification = createNotification()
    
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
            NOTIFICATION_ID, 
            notification, 
            ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING
        )
    } else {
        startForeground(NOTIFICATION_ID, notification)
    }

    // Initialize your backend/server here
    return START_STICKY
}
```

---

## 4. User Permissions & UX

### Notification Permission (Android 13+)
Since a Foreground Service **must** show a notification, the app will fail to start the service if the user denies notification permissions.

```kotlin
private fun requestNotificationPermission() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_CODE)
        }
    }
}
```

### Interactive Notifications
Always provide a `PendingIntent` so the user can return to the app by tapping the notification.

```kotlin
private fun createNotification(): Notification {
    val intent = Intent(this, MainActivity::class.java)
    val pendingIntent = PendingIntent.getActivity(
        this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("Service Running")
        .setContentText("Your background process is active.")
        .setSmallIcon(R.drawable.ic_notification)
        .setContentIntent(pendingIntent)
        .setOngoing(true)
        .build()
}
```

---

## 5. Dynamic JNI Path Management

When working with a Rust/Native backend, never hardcode paths (e.g., `/data/data/com.app/...`). Always pass the dynamic `filesDir` from Kotlin to the native layer.

### Native Rust (JNI)
```rust
#[no_mangle]
pub extern "C" fn Java_com_example_Service_startRustServer(
    mut env: JNIEnv,
    _class: JClass,
    base_path: JString,
) {
    let base_path_str: String = env.get_string(&base_path).unwrap().into();
    let data_dir = std::path::PathBuf::from(base_path_str).join("my_data");
    // ... use data_dir
}
```

### Kotlin
```kotlin
val basePath = context.filesDir.absolutePath
startRustServer(port, basePath)
```

---

## 6. Persistence Hardening (Ensuring "Always-On")

Android's battery management is aggressive. To ensure a service stays alive indefinitely, use these three layers of protection:

### Layer 1: The `onTaskRemoved` Safety Net
When a user swipes an app out of the "Recents" screen, the OS may kill the process. Overriding `onTaskRemoved` allows you to schedule an immediate restart.

```kotlin
override fun onTaskRemoved(rootIntent: Intent?) {
    // Schedule a restart via AlarmManager
    BlossomService.startService(this)
    super.onTaskRemoved(rootIntent)
}
```

### Layer 2: Battery Optimization Exemption
This is the most critical step for OEMs like Samsung or Xiaomi. Without this, the OS will "freeze" your background process after a few minutes of screen-off time.

```kotlin
fun requestBatteryOptimizationExemption(context: Context) {
    val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    if (!pm.isIgnoringBatteryOptimizations(context.packageName)) {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:${context.packageName}")
        }
        context.startActivity(intent)
    }
}
```

### Layer 3: Periodic "Self-Healing" (WorkManager)
Even with the above, a service might still be killed due to extreme memory pressure. Use `WorkManager` to run a "Check and Start" task every few hours.

1. Create a Worker:
```kotlin
class ServiceCheckWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        // This will restart the service if it's not running
        YourService.startService(applicationContext)
        return Result.success()
    }
}
```

2. Schedule it as a Periodic Work:
```kotlin
val workRequest = PeriodicWorkRequestBuilder<ServiceCheckWorker>(8, TimeUnit.HOURS).build()
WorkManager.getInstance(context).enqueueUniquePeriodicWork(
    "ServicePersistence",
    ExistingPeriodicWorkPolicy.KEEP,
    workRequest
)
```

### OEM-Specific Advice (Don't Kill My App)
Different manufacturers have different background killers. It is recommended to direct users to [dontkillmyapp.com](https://dontkillmyapp.com/) if they notice the service stopping, as some restrictions (like "App Standby Buckets") can only be changed by the user in system settings.
