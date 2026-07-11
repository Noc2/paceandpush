package com.paceandpush

import org.json.JSONObject

internal const val PUBLIC_HEALTH_DATA_CONSENT_VERSION = "public-health-v1"

internal data class PublicHealthSharingState(
    val isPublic: Boolean,
    val sharesDatedHistory: Boolean,
    val consentVersion: String?,
    val consentedAt: String?,
)

internal fun parsePublicHealthSharingState(json: JSONObject): PublicHealthSharingState {
    val consentVersion = json.optString("publicHealthDataConsentVersion")
        .trim()
        .takeIf { it.isNotBlank() }
    val consentedAt = json.optString("publicHealthDataConsentedAt")
        .trim()
        .takeIf { it.isNotBlank() }
    val hasCurrentConsent =
        consentVersion == PUBLIC_HEALTH_DATA_CONSENT_VERSION && consentedAt != null
    val isPublic = json.optBoolean("publicLeaderboard", false) && hasCurrentConsent

    return PublicHealthSharingState(
        isPublic = isPublic,
        sharesDatedHistory = isPublic && json.optBoolean("publicActivityHistory", false),
        consentVersion = consentVersion.takeIf { hasCurrentConsent },
        consentedAt = consentedAt.takeIf { hasCurrentConsent },
    )
}

internal fun publicHealthSettingsPayload(
    publish: Boolean,
    publicActivityHistory: Boolean = false,
): JSONObject {
    val payload = JSONObject().put("publicLeaderboard", publish)
    if (publish) {
        payload.put(
            "publicHealthDataConsent",
            JSONObject()
                .put("version", PUBLIC_HEALTH_DATA_CONSENT_VERSION)
                .put("publishExactPeriodKilometers", true)
                .put("publicActivityHistory", publicActivityHistory),
        )
    }
    return payload
}

internal fun confirmsPublicHealthSharingRequest(
    state: PublicHealthSharingState,
    publish: Boolean,
    publicActivityHistory: Boolean,
): Boolean {
    return if (publish) {
        state.isPublic && state.sharesDatedHistory == publicActivityHistory
    } else {
        !state.isPublic && !state.sharesDatedHistory
    }
}
