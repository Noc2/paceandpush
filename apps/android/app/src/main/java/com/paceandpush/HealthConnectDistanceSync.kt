package com.paceandpush

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.LocalDate
import java.time.Period

class HealthConnectDistanceSync(private val context: Context) {
    private val client: HealthConnectClient by lazy {
        HealthConnectClient.getOrCreate(context)
    }

    val permissions: Set<String> = setOf(
        HealthPermission.getReadPermission(DistanceRecord::class),
    )

    fun sdkStatus(): Int {
        return HealthConnectClient.getSdkStatus(context)
    }

    suspend fun hasPermissions(): Boolean {
        return client.permissionController.getGrantedPermissions().containsAll(permissions)
    }

    suspend fun collectDistanceDays(
        startDate: LocalDate,
        endDate: LocalDate = LocalDate.now(),
    ): HealthConnectDistanceSyncResult {
        val startedAt = System.currentTimeMillis()
        val response = client.aggregateGroupByPeriod(
            AggregateGroupByPeriodRequest(
                metrics = setOf(DistanceRecord.DISTANCE_TOTAL),
                timeRangeFilter = TimeRangeFilter.between(
                    startDate.atStartOfDay(),
                    endDate.plusDays(1).atStartOfDay(),
                ),
                timeRangeSlicer = Period.ofDays(1),
            ),
        )

        val days = response.mapNotNull { bucket ->
            val meters = bucket.result[DistanceRecord.DISTANCE_TOTAL]?.inMeters ?: 0.0
            if (meters <= 0.0) {
                null
            } else {
                val date = bucket.startTime.toLocalDate().toString()
                HealthConnectDistanceDay(
                    date = date,
                    meters = meters,
                    sourceHash = "healthconnect-android-$date-${meters.toLong()}",
                )
            }
        }

        return HealthConnectDistanceSyncResult(
            days = days,
            startedAtEpochMillis = startedAt,
            finishedAtEpochMillis = System.currentTimeMillis(),
        )
    }
}

data class HealthConnectDistanceSyncResult(
    val days: List<HealthConnectDistanceDay>,
    val startedAtEpochMillis: Long,
    val finishedAtEpochMillis: Long,
)

data class HealthConnectDistanceDay(
    val date: String,
    val meters: Double,
    val sourcePlatform: String = "android",
    val sourceHash: String,
)
