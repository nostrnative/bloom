package com.blossom.server

import android.os.Bundle
import android.content.Intent
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    val intent = Intent(this, BlossomService::class.java)
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      startForegroundService(intent)
    } else {
      startService(intent)
    }
  }
}
