import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val firebaseProperties = Properties().apply {
    val file = rootProject.file("firebase.properties")
    if (file.exists()) {
        file.inputStream().use { load(it) }
    }
}

fun firebaseField(name: String): String {
    val value = firebaseProperties.getProperty(name, "").replace("\"", "\\\"")
    return "\"$value\""
}

android {
    namespace = "com.perrinresearch.homeboard"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.perrinresearch.homeboard"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "FIREBASE_API_KEY", firebaseField("FIREBASE_API_KEY"))
        buildConfigField("String", "FIREBASE_APP_ID", firebaseField("FIREBASE_APP_ID"))
        buildConfigField("String", "FIREBASE_PROJECT_ID", firebaseField("FIREBASE_PROJECT_ID"))
        buildConfigField("String", "BOARD_URL", firebaseField("BOARD_URL").let {
            if (it == "\"\"") "\"http://homeboard.local\"" else it
        })
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.09.03")
    implementation(composeBom)
    implementation("androidx.activity:activity-compose:1.9.2")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.6")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.6")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("com.google.firebase:firebase-bom:33.4.0")
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-firestore")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
