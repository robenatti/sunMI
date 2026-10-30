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
    // Pagina HTML/CSS/JS del display cliente condivisa con AltraCassa App.
    sourceSets {
        getByName("main") {
            assets.srcDir("../shared")
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
    val displayJs = layout.projectDirectory.file("native/secondoSchermo.js").asFile
    val destination = layout.projectDirectory.file("src/main/assets/js/protocollo17-nexi.js").asFile

    inputs.files(interfaceJs, netJs, protocolJs, displayJs)
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
            // Adapter cliente nello stesso bundle del POS, senza altri script HTML.
            // Bridge resta disponibile grazie alla IIFE condivisa.
            appendLine(displayJs.readText(Charsets.UTF_8))
            appendLine("})();")
            appendLine(protocolJs.readText(Charsets.UTF_8))
            appendLine(
                """
                // Adattatore POS SolX: risolve Config.terminalePOS["CC"].
                // Il protocollo condiviso con AltraCassa rimane invariato.
                (function () {
                    "use strict";

                    var originalSetup = TerminalePOS.setupPOS;
                    var configured = false;

                    function configFromSolX() {
                        if (typeof Config === "undefined" || !Config || !Config.terminalePOS)
                            return null;
                        var pos = Config.terminalePOS;
                        return pos["CC"] || (pos.host ? pos : null);
                    }

                    function validConfig(cfg) {
                        return !!(cfg && cfg.host && cfg.port && cfg.terminalId);
                    }

                    function configure(cfg) {
                        // SolX usa per prima la configurazione CC del salone.
                        // Non si tenta di leggere il vecchio file INI Windows nella WebView.
                        var salonConfig = configFromSolX();
                        var effective = validConfig(salonConfig) ? salonConfig : cfg;
                        if (!validConfig(effective)) return false;
                        var result = originalSetup(effective);
                        configured = !!result;
                        return result;
                    }

                    TerminalePOS.setupPOS = configure;

                    [
                        ["checkPOS", 1],
                        ["payPOS", 2],
                        ["extendedPOS", 2],
                        ["refundPOS", 2],
                        ["checkLast", 2],
                        ["getTotals", 2],
                        ["rePrint", 2],
                        ["closeDay", 2]
                    ].forEach(function (item) {
                        var name = item[0], callbackIndex = item[1];
                        var original = TerminalePOS[name];
                        TerminalePOS[name] = function () {
                            var args = Array.prototype.slice.call(arguments);
                            if (!configured || args[0] != null) {
                                if (!configure(args[0])) {
                                    if (typeof args[callbackIndex] === "function")
                                        args[callbackIndex](false, "CONFIG_POS_NON_VALIDA: impostare Config.terminalePOS.CC con host, port, terminalId e registerId");
                                    return false;
                                }
                            }
                            // La configurazione e' gia' stata memorizzata in CFG.
                            // Evita che il modulo originale tenti di leggere un file INI.
                            args[0] = null;
                            return original.apply(TerminalePOS, args);
                        };
                    });
                })();
                """.trimIndent()
            )
        }
        destination.parentFile.mkdirs()
        destination.writeText(bundled, Charsets.UTF_8)
    }
}

tasks.matching { it.name == "preBuild" }.configureEach {
    dependsOn(installSolXNativePos)
}
