package com.paceandpush

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

class PermissionsRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(
            TextView(this).apply {
                text = "Pace & Push reads daily distance totals from Health Connect to calculate your leaderboard score. Raw workouts are not uploaded in the PoC."
                textSize = 18f
                setPadding(48, 48, 48, 48)
            },
        )
    }
}
