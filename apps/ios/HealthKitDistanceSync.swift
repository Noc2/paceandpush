import Foundation

#if canImport(HealthKit)
import HealthKit

struct HealthKitDistanceDay: Encodable, Identifiable {
    let id: String
    let date: String
    let meters: Double
    let sourcePlatform: String
    let sourceHash: String
}

struct HealthKitDistanceSyncResult {
    let days: [HealthKitDistanceDay]
    let startedAt: Date
    let finishedAt: Date
}

enum HealthKitDistanceSyncError: Error {
    case unavailable
    case missingDistanceType
}

final class HealthKitDistanceSync {
    private let healthStore = HKHealthStore()
    private let calendar = Calendar(identifier: .gregorian)

    var isAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    func requestAuthorization() async throws {
        guard isAvailable else { throw HealthKitDistanceSyncError.unavailable }
        guard let distanceType = Self.distanceType else {
            throw HealthKitDistanceSyncError.missingDistanceType
        }

        try await healthStore.requestAuthorization(toShare: [], read: [distanceType])
    }

    func collectDistanceDays(
        from startDate: Date,
        through endDate: Date = Date(),
    ) async throws -> HealthKitDistanceSyncResult {
        guard isAvailable else { throw HealthKitDistanceSyncError.unavailable }
        guard let distanceType = Self.distanceType else {
            throw HealthKitDistanceSyncError.missingDistanceType
        }

        let startedAt = Date()
        let days = try await dailyDistance(
            distanceType: distanceType,
            startDate: calendar.startOfDay(for: startDate),
            endDate: calendar.startOfDay(for: endDate).addingTimeInterval(24 * 60 * 60),
        )

        return HealthKitDistanceSyncResult(
            days: days,
            startedAt: startedAt,
            finishedAt: Date(),
        )
    }

    private func dailyDistance(
        distanceType: HKQuantityType,
        startDate: Date,
        endDate: Date,
    ) async throws -> [HealthKitDistanceDay] {
        try await withCheckedThrowingContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(
                withStart: startDate,
                end: endDate,
                options: .strictStartDate,
            )
            let query = HKStatisticsCollectionQuery(
                quantityType: distanceType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum,
                anchorDate: startDate,
                intervalComponents: DateComponents(day: 1),
            )

            query.initialResultsHandler = { _, collection, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                var days: [HealthKitDistanceDay] = []
                collection?.enumerateStatistics(from: startDate, to: endDate) { stats, _ in
                    let meters = stats.sumQuantity()?.doubleValue(for: .meter()) ?? 0
                    guard meters > 0 else { return }
                    let date = Self.dayFormatter.string(from: stats.startDate)
                    days.append(
                        HealthKitDistanceDay(
                            id: date,
                            date: date,
                            meters: meters,
                            sourcePlatform: "ios",
                            sourceHash: "healthkit-ios-\(date)-\(Int(meters.rounded()))",
                        ),
                    )
                }

                continuation.resume(returning: days)
            }

            healthStore.execute(query)
        }
    }

    private static var distanceType: HKQuantityType? {
        HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning)
    }

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
#else
struct HealthKitDistanceDay: Encodable, Identifiable {
    let id: String
    let date: String
    let meters: Double
    let sourcePlatform: String
    let sourceHash: String
}

struct HealthKitDistanceSyncResult {
    let days: [HealthKitDistanceDay]
    let startedAt: Date
    let finishedAt: Date
}

final class HealthKitDistanceSync {
    var isAvailable: Bool { false }

    func requestAuthorization() async throws {
        throw HealthKitDistanceSyncUnavailable()
    }

    func collectDistanceDays(
        from startDate: Date,
        through endDate: Date = Date(),
    ) async throws -> HealthKitDistanceSyncResult {
        throw HealthKitDistanceSyncUnavailable()
    }
}

struct HealthKitDistanceSyncUnavailable: Error {}
#endif
