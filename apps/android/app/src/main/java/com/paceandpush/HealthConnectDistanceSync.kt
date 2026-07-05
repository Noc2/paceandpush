package com.paceandpush

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.LocalDate
import java.time.ZoneOffset

class HealthConnectDistanceSync(private val context: Context) {
    private val client: HealthConnectClient by lazy {
        HealthConnectClient.getOrCreate(context)
    }

    val permissions: Set<String> = setOf(
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
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
        val sessions = client.readRecords(
            ReadRecordsRequest<ExerciseSessionRecord>(
                timeRangeFilter = TimeRangeFilter.between(
                    startDate.atStartOfDay(),
                    endDate.plusDays(1).atStartOfDay(),
                ),
            ),
        )
            .records
            .filter { session -> session.exerciseType in runningExerciseTypes }

        val metersByDate = mutableMapOf<LocalDate, Double>()
        for (session in sessions) {
            val meters = distanceMetersFor(session)
            if (meters <= 0.0) continue

            val date = session.startTime.atZone(ZoneOffset.UTC).toLocalDate()
            metersByDate[date] = (metersByDate[date] ?: 0.0) + meters
        }

        val days = metersByDate.toSortedMap().map { (date, meters) ->
            HealthConnectDistanceDay(
                date = date.toString(),
                meters = meters,
                sourceHash = "healthconnect-android-running-$date-${meters.toLong()}",
            )
        }

        return HealthConnectDistanceSyncResult(
            days = days,
            startedAtEpochMillis = startedAt,
            finishedAtEpochMillis = System.currentTimeMillis(),
        )
    }

    private suspend fun distanceMetersFor(session: ExerciseSessionRecord): Double {
        val response = client.aggregate(
            AggregateRequest(
                metrics = setOf(DistanceRecord.DISTANCE_TOTAL),
                timeRangeFilter = TimeRangeFilter.between(session.startTime, session.endTime),
                dataOriginFilter = setOf(session.metadata.dataOrigin),
            ),
        )

        return response[DistanceRecord.DISTANCE_TOTAL]?.inMeters ?: 0.0
    }

    private companion object {
        val runningExerciseTypes = setOf(
            ExerciseSessionRecord.EXERCISE_TYPE_RUNNING,
            ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL,
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
