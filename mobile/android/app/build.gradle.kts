import java.util.Base64

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.dtexchange.dt_exchange"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // Stable DT Exchange application identity; review ownership before release.
        val publicTest = System.getenv("DT_ANDROID_PUBLIC_TEST") == "true"
        val simulation = System.getenv("DT_ANDROID_SIMULATION") == "true"
        val dartDefines = (project.findProperty("dart-defines") as String?)?.split(",")?.map {
            String(Base64.getDecoder().decode(it), Charsets.UTF_8)
        } ?: emptyList()
        require(!(publicTest && simulation) &&
            (publicTest || simulation) == dartDefines.contains("DT_PUBLIC_TEST=true") &&
            simulation == dartDefines.contains("DT_SIMULATION_RELEASE=true")) {
            "Test application identity must match the Dart test mode."
        }
        applicationId = if (publicTest) "com.dtexchange.dt_exchange.publictest" else "com.dtexchange.dt_exchange"
        manifestPlaceholders["dtAppLabel"] = if(publicTest) "DT Exchange Test" else "DT Exchange"
        manifestPlaceholders["dtLinkScheme"] = if(publicTest) "dtexchange-test" else "dtexchange"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("production") {
            val signingPath = System.getenv("DT_ANDROID_KEYSTORE")
            if (signingPath != null) {
                storeFile = file(signingPath)
                storePassword = System.getenv("DT_ANDROID_STORE_PASSWORD")
                keyAlias = System.getenv("DT_ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("DT_ANDROID_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (System.getenv("DT_ANDROID_KEYSTORE") != null) signingConfig = signingConfigs.getByName("production")
            // Production signing must be supplied securely during release preparation.
            // A release build is deliberately not signed with a debug key.
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
