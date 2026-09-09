import java.net.URI
import java.nio.file.Files
import java.nio.file.StandardCopyOption

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

val pouchDbVersion = "9.0.0"
val pouchDbAssetsDir = layout.buildDirectory.dir("generated/pouchdbAssets")
val pouchDbAssetFile = pouchDbAssetsDir.map {
    it.file("js/vendor/pouchdb-$pouchDbVersion.min.js")
}
val pouchDbCacheFile = File(
    gradle.gradleUserHomeDir,
    "caches/sunmi-pouchdb/pouchdb-$pouchDbVersion.min.js"
)

val preparePouchDbAsset by tasks.registering {
    outputs.file(pouchDbAssetFile)

    doLast {
        if (!pouchDbCacheFile.exists()) {
            pouchDbCacheFile.parentFile.mkdirs()

            URI(
                "https://github.com/apache/pouchdb/releases/download/" +
                    "$pouchDbVersion/pouchdb-$pouchDbVersion.min.js"
            ).toURL().openStream().use { input ->
                Files.copy(
                    input,
                    pouchDbCacheFile.toPath(),
                    StandardCopyOption.REPLACE_EXISTING
                )
            }
        }

        val output = pouchDbAssetFile.get().asFile
        output.parentFile.mkdirs()
        pouchDbCacheFile.copyTo(output, overwrite = true)
    }
}

android {
    namespace = "com.example.sunmitest2"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.example.sunmitest2"
        minSdk = 23
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    sourceSets {
        getByName("main").assets.srcDir(pouchDbAssetsDir)
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
}

tasks.named("preBuild").configure {
    dependsOn(preparePouchDbAsset)
}

dependencies {

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.activity)
    implementation(libs.androidx.constraintlayout)
    implementation("androidx.webkit:webkit:1.15.0")
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)

    implementation("com.sunmi:printerlibrary:1.0.15")

}
