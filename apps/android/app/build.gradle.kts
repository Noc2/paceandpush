plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.paceandpush"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.paceandpush"
        minSdk = 28
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }
}

dependencies {
    implementation("androidx.health.connect:connect-client:1.2.0-alpha04")
}
