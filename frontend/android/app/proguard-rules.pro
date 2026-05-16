# MediScribe ProGuard / R8 rules

# Keep Capacitor bridge intact — JS interface must not be renamed
-keep class com.getcapacitor.** { *; }
-keep class in.mediscribe.app.** { *; }
-dontwarn com.getcapacitor.**

# WebView JS interface: keep all public members
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep line numbers for crash stack traces
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Suppress warnings from unused optional deps
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
