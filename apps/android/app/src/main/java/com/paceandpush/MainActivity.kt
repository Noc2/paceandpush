package com.paceandpush

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(
            TextView(this).apply {
                text = "Pace & Push"
                textSize = 28f
                setPadding(32, 32, 32, 32)
            },
        )
    }
}
