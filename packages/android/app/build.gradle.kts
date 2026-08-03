plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "dev.slopcode.android"
  compileSdk = 35

  defaultConfig {
    applicationId = "dev.slopcode.android"
    minSdk = 29
    targetSdk = 35
    versionCode = 1
    versionName = (project.findProperty("slopcodeVersion") as String? ?: "0.1.0").trim()
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    buildConfigField("String", "SLOPCODE_WEB_ENTRY", "\"https://appassets.androidplatform.net/site/index.html\"")
    buildConfigField(
      "String",
      "SLOPCODE_REMOTE_BASE_URL",
      "\"${(project.findProperty("slopcodeRemoteBaseUrl") as String? ?: "").trim()}\"",
    )
  }

  buildFeatures {
    buildConfig = true
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
  }

  kotlinOptions {
    jvmTarget = "21"
  }

  packaging {
    resources {
      excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
  }

  sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/assets/site"))
}

val syncWebAssets by tasks.registering(Sync::class) {
  from(rootProject.layout.projectDirectory.dir("dist"))
  into(layout.buildDirectory.dir("generated/assets/site"))
}

tasks.matching { it.name.startsWith("merge") && it.name.endsWith("Assets") }.configureEach {
  dependsOn(syncWebAssets)
}

dependencies {
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("androidx.core:core-ktx:1.15.0")
  implementation("androidx.core:core-splashscreen:1.0.1")
  implementation("androidx.security:security-crypto:1.1.0-alpha06")
  implementation("androidx.webkit:webkit:1.12.1")
  implementation("com.google.android.material:material:1.12.0")
  implementation("com.squareup.okhttp3:okhttp:4.12.0")
  implementation("com.google.firebase:firebase-messaging:24.1.2")
  implementation("com.github.mwiede:jsch:2.28.4")
  implementation("org.bouncycastle:bcprov-jdk18on:1.77")
  testImplementation("junit:junit:4.13.2")
  testImplementation("org.json:json:20240303")
  androidTestImplementation("androidx.test:runner:1.6.2")
  androidTestImplementation("androidx.test:core:1.6.1")
  androidTestImplementation("androidx.test.ext:junit:1.2.1")
}
