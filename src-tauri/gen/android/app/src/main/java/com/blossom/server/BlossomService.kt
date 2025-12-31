package com.blossom.server

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

class BlossomService : Service() {
    private val TAG = "BlossomService"
    private val CHANNEL_ID = "BlossomServerChannel"
    private val NOTIFICATION_ID = 1

    // Native methods from Rust
    private external fun startRustServer(port: Int)
    private external fun stopRustServer()

    companion object {
        init {
            // Load the Rust library
            System.loadLibrary("blossom")
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "BlossomService created")
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "BlossomService started")

        val notification = createNotification()
        startForeground(NOTIFICATION_ID, notification)

        // Start the Rust server on a default port or from intent
        val port = intent?.getIntExtra("port", 24242) ?: 24242
        startRustServer(port)

        return START_STICKY
    }

    override fun onDestroy() {
        Log.d(TAG, "BlossomService destroying")
        stopRustServer()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun createNotification(): Notification {
        val title = "Blossom Server"
        val message = "Server is running in the background"

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(message)
            .setSmallIcon(android.R.drawable.ic_dialog_info) // Should be replaced with app icon
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Blossom Background Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(serviceChannel)
        }
    }
}
