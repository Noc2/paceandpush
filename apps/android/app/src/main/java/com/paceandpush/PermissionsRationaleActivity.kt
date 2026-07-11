package com.paceandpush

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

class PermissionsRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(
            TextView(this).apply {
                text = "Pace & Push reads running exercise sessions from Health Connect to calculate daily running-distance aggregates for your score. Only those daily totals are uploaded to your private Pace & Push account; raw workouts and routes are not uploaded. Granting Health Connect access does not make anything public. Publishing exact period kilometers and other profile totals is a separate, optional choice in Settings."
                textSize = 18f
                setPadding(48, 48, 48, 48)
            },
        )
    }
}
