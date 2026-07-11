package com.paceandpush

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PublicHealthDataConsentTest {
    @Test
    fun `current consent enables the public summary and separately parses history`() {
        val state = parsePublicHealthSharingState(
            JSONObject()
                .put("publicLeaderboard", true)
                .put("publicActivityHistory", true)
                .put("publicHealthDataConsentVersion", PUBLIC_HEALTH_DATA_CONSENT_VERSION)
                .put("publicHealthDataConsentedAt", "2026-07-11T12:00:00Z"),
        )

        assertTrue(state.isPublic)
        assertTrue(state.sharesDatedHistory)
        assertEquals(PUBLIC_HEALTH_DATA_CONSENT_VERSION, state.consentVersion)
        assertEquals("2026-07-11T12:00:00Z", state.consentedAt)
    }

    @Test
    fun `legacy or incomplete publication state fails closed`() {
        val legacyState = parsePublicHealthSharingState(
            JSONObject()
                .put("publicLeaderboard", true)
                .put("publicActivityHistory", true),
        )
        val missingTimestampState = parsePublicHealthSharingState(
            JSONObject()
                .put("publicLeaderboard", true)
                .put("publicActivityHistory", true)
                .put("publicHealthDataConsentVersion", PUBLIC_HEALTH_DATA_CONSENT_VERSION),
        )

        listOf(legacyState, missingTimestampState).forEach { state ->
            assertFalse(state.isPublic)
            assertFalse(state.sharesDatedHistory)
            assertNull(state.consentVersion)
            assertNull(state.consentedAt)
        }
    }

    @Test
    fun `publication payload proves exact kilometers and keeps history independent`() {
        val payload = publicHealthSettingsPayload(
            publish = true,
            publicActivityHistory = false,
        )
        val consent = payload.getJSONObject("publicHealthDataConsent")

        assertTrue(payload.getBoolean("publicLeaderboard"))
        assertEquals(PUBLIC_HEALTH_DATA_CONSENT_VERSION, consent.getString("version"))
        assertTrue(consent.getBoolean("publishExactPeriodKilometers"))
        assertFalse(consent.getBoolean("publicActivityHistory"))
    }

    @Test
    fun `withdrawal payload does not repeat or imply consent`() {
        val payload = publicHealthSettingsPayload(
            publish = false,
            publicActivityHistory = true,
        )

        assertFalse(payload.getBoolean("publicLeaderboard"))
        assertFalse(payload.has("publicHealthDataConsent"))
    }

    @Test
    fun `requested privacy state requires an exact authoritative confirmation`() {
        val publicWithoutHistory = PublicHealthSharingState(
            isPublic = true,
            sharesDatedHistory = false,
            consentVersion = PUBLIC_HEALTH_DATA_CONSENT_VERSION,
            consentedAt = "2026-07-11T12:00:00Z",
        )
        val privateState = PublicHealthSharingState(
            isPublic = false,
            sharesDatedHistory = false,
            consentVersion = null,
            consentedAt = null,
        )

        assertTrue(confirmsPublicHealthSharingRequest(publicWithoutHistory, true, false))
        assertFalse(confirmsPublicHealthSharingRequest(publicWithoutHistory, true, true))
        assertFalse(confirmsPublicHealthSharingRequest(privateState, true, false))
        assertTrue(confirmsPublicHealthSharingRequest(privateState, false, false))
    }
}
