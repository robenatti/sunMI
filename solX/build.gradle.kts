plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "it.altracassa.solx"
    compileSdk = 36

    defaultConfig {
        applicationId = "it.altracassa.solx"
        minSdk = 23
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
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


// Il BAT distribuisce gli asset del salone; la build reinstalla il driver SUNMI.
// La sovrascrittura avviene prima del packaging dell'APK.
val installSolXNativeReceipt = tasks.register<Copy>("installSolXNativeReceipt") {
    from(layout.projectDirectory.file("native/receipt.js"))
    into(layout.projectDirectory.dir("src/main/assets/config"))
    rename { "receipt.js" }
}
tasks.matching { it.name == "preBuild" }.configureEach {
    dependsOn(installSolXNativeReceipt)
}


// Il protocollo Nexi di AltraCassa viene riutilizzato senza duplicarlo.
// Il pacchetto comprende il bridge WebView e il trasporto TCP: SolX carica
// gia' js/protocollo17-nexi.js, quindi non occorrono modifiche all'HTML storico.
val installSolXNativePos = tasks.register("installSolXNativePos") {
    val commonJs = rootProject.layout.projectDirectory.dir("app/src/main/assets/js")
    val interfaceJs = commonJs.file("interfaceKotlin.js").asFile
    val netJs = commonJs.file("net-android.js").asFile
    val protocolJs = commonJs.file("protocollo17-nexi.js").asFile
    val destination = layout.projectDirectory.file("src/main/assets/js/protocollo17-nexi.js").asFile

    inputs.files(interfaceJs, netJs, protocolJs)
    outputs.file(destination)

    doLast {
        val bundled = buildString {
            appendLine("// SolX - driver POS Android. Generato durante la build.")
            appendLine("// Protocollo 17 condiviso con AltraCassa; setupPOS(cfg) usa la configurazione passata da SolX (Config).")
            appendLine("(function () {")
            appendLine("    var previousSolXNativeResponse = window.onNativeResponse;")
            appendLine(interfaceJs.readText(Charsets.UTF_8))
            appendLine(
                """
                // Il POS riceve solo le proprie risposte; stampa e altri callback
                // continuano a essere inoltrati al gestore precedente.
                window.onNativeResponse = function (response) {
                    var value;
                    try {
                        value = typeof response === "string" ? JSON.parse(response) : response;
                    } catch (e) {
                        if (typeof previousSolXNativeResponse === "function") previousSolXNativeResponse(response);
                        return;
                    }
                    if (value && Object.prototype.hasOwnProperty.call(Bridge.callbacks, value.id)) {
                        Bridge.onNativeResponse(response);
                    } else if (typeof previousSolXNativeResponse === "function") {
                        previousSolXNativeResponse(response);
                    }
                };
                """.trimIndent()
            )
            appendLine(netJs.readText(Charsets.UTF_8))
            appendLine("})();")
            appendLine(protocolJs.readText(Charsets.UTF_8))
        }
        destination.parentFile.mkdirs()
        destination.writeText(bundled, Charsets.UTF_8)
    }
}

tasks.matching { it.name == "preBuild" }.configureEach {
    dependsOn(installSolXNativePos)
}
