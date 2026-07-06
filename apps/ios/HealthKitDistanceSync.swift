import Foundation

struct HealthKitDistanceDay: Encodable, Equatable, Identifiable {
    let id: String
    let date: String
    let meters: Double
    let sourcePlatform: String
    let sourceHash: String
}

struct HealthKitDistanceSyncResult: Equatable {
    let days: [HealthKitDistanceDay]
    let startedAt: Date
    let finishedAt: Date
}

struct RunningDistanceSample {
    let startDate: Date
    let meters: Double
}

enum RunningDistanceAggregator {
    static func distanceDays(from samples: [RunningDistanceSample]) -> [HealthKitDistanceDay] {
        var metersByDate: [String: Double] = [:]

        for sample in samples where sample.meters > 0 {
            let date = dayFormatter.string(from: sample.startDate)
            metersByDate[date, default: 0] += sample.meters
        }

        return metersByDate.keys.sorted().compactMap { date in
            guard let meters = metersByDate[date], meters > 0 else { return nil }

            return HealthKitDistanceDay(
                id: date,
                date: date,
                meters: meters,
                sourcePlatform: "ios",
                sourceHash: "healthkit-ios-running-\(date)-\(Int(meters.rounded()))",
            )
        }
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

protocol HealthDistanceSyncing {
    var isAvailable: Bool { get }

    func requestAuthorization() async throws
    func collectDistanceDays(from startDate: Date, through endDate: Date) async throws -> HealthKitDistanceSyncResult
}

#if canImport(HealthKit)
import HealthKit

enum HealthKitDistanceSyncError: Error {
    case unavailable
}

final class HealthKitDistanceSync: HealthDistanceSyncing {
    private let healthStore = HKHealthStore()
    private let calendar = Calendar(identifier: .gregorian)

    var isAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    func requestAuthorization() async throws {
        guard isAvailable else { throw HealthKitDistanceSyncError.unavailable }

        try await healthStore.requestAuthorization(toShare: [], read: [Self.workoutType])
    }

    func collectDistanceDays(
        from startDate: Date,
        through endDate: Date = Date(),
    ) async throws -> HealthKitDistanceSyncResult {
        guard isAvailable else { throw HealthKitDistanceSyncError.unavailable }

        let startedAt = Date()
        let days = try await dailyRunningDistance(
            startDate: calendar.startOfDay(for: startDate),
            endDate: calendar.startOfDay(for: endDate).addingTimeInterval(24 * 60 * 60),
        )

        return HealthKitDistanceSyncResult(
            days: days,
            startedAt: startedAt,
            finishedAt: Date(),
        )
    }

    private func dailyRunningDistance(
        startDate: Date,
        endDate: Date,
    ) async throws -> [HealthKitDistanceDay] {
        let samples = try await runningWorkouts(startDate: startDate, endDate: endDate).map {
            RunningDistanceSample(
                startDate: $0.startDate,
                meters: $0.totalDistance?.doubleValue(for: .meter()) ?? 0,
            )
        }

        return RunningDistanceAggregator.distanceDays(from: samples)
    }

    private func runningWorkouts(
        startDate: Date,
        endDate: Date,
    ) async throws -> [HKWorkout] {
        try await withCheckedThrowingContinuation { continuation in
            let datePredicate = HKQuery.predicateForSamples(
                withStart: startDate,
                end: endDate,
                options: .strictStartDate,
            )
            let runningPredicate = HKQuery.predicateForWorkouts(with: .running)
            let predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [
                datePredicate,
                runningPredicate,
            ])
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
            let query = HKSampleQuery(
                sampleType: Self.workoutType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [sort],
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                continuation.resume(returning: samples as? [HKWorkout] ?? [])
            }

            healthStore.execute(query)
        }
    }

    private static let workoutType = HKObjectType.workoutType()
}
#else
final class HealthKitDistanceSync: HealthDistanceSyncing {
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
