import React, { useEffect } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Alert, Platform, StatusBar, I18nManager, View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import { useFonts, Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold } from "@expo-google-fonts/tajawal";
import { Cairo_700Bold, Cairo_800ExtraBold, Cairo_900Black } from "@expo-google-fonts/cairo";

import AuthScreen from "./src/screens/AuthScreen";
import HomeScreen from "./src/screens/HomeScreen";
import SectionScreen from "./src/screens/SectionScreen";
import SubscriptionScreen from "./src/screens/SubscriptionScreen";
import PlatformsScreen from "./src/screens/PlatformsScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import { COLORS } from "./src/lib/theme";
import { ThemeProvider, useTheme } from "./src/lib/ThemeContext";
import ErrorBoundary from "./src/lib/ErrorBoundary";
import { registerDevice } from "./src/lib/api";
import { initStore, closeStore, setupPurchaseListeners } from "./src/lib/payments";

// فرض الاتجاه من اليمين لليسار (RTL) من جذر التطبيق
try {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
  I18nManager.swapLeftAndRightInRTL(true);
} catch (e) {}

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

// شاشة المساعد التقديري (تبويب بلا params) — تمرّر section افتراضي آمن
function ToolsScreen(props) {
  const toolRoute = { params: { section: { id: "calculators", title: "المساعد التقديري", icon: "calculator" } } };
  return <SectionScreen {...props} route={toolRoute} />;
}

// التبويبات الأربعة — لا stack متداخل، الشاشات الفرعية في RootStack
function MainTabs() {
  const { theme: TH } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          bottom: Platform.OS === "ios" ? 24 : 14,
          left: 16, right: 16, height: 70, borderRadius: 24,
          backgroundColor: TH.g2, borderWidth: 0, borderTopWidth: 0,
          flexDirection: "row-reverse",
          justifyContent: "space-around",
          alignItems: "center",
          shadowColor: "#0F5132", shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.28, shadowRadius: 20, elevation: 12,
          paddingBottom: 0, paddingTop: 0,
        },
        tabBarItemStyle: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 8 },
        tabBarActiveTintColor: TH.accentLite,
        tabBarInactiveTintColor: "rgba(255,255,255,0.55)",
        tabBarLabelStyle: { fontFamily: "Cairo_700Bold", fontSize: 10, marginTop: 2, flexShrink: 1, textAlign: "center" },
        tabBarIcon: ({ color }) => {
          const icons = { الرئيسية: "home", "المساعد التقديري": "calculator", الاشتراكات: "crown", حسابي: "user" };
          return <FontAwesome5 name={icons[route.name] || "circle"} size={18} color={color} />;
        },
      })}
    >
      <Tab.Screen name="الرئيسية" component={HomeScreen} />
      <Tab.Screen name="المساعد التقديري" component={ToolsScreen} />
      <Tab.Screen name="الاشتراكات" component={SubscriptionScreen} />
      <Tab.Screen name="حسابي" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function AppInner() {
  const { theme: TH, ready } = useTheme();

  const NavTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: COLORS.bg, card: COLORS.bgPure, text: COLORS.onyx,
      border: COLORS.border, primary: TH.primary,
    },
  };

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={TH.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={NavTheme}>
      <StatusBar barStyle="light-content" backgroundColor={TH.g1} />
      {/* Stack جذري واحد مسطّح — لا تعشيش متعارض. البصمة أولاً ثم التبويبات والشاشات الفرعية */}
      <RootStack.Navigator initialRouteName="Auth" screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Auth" component={AuthScreen} />
        <RootStack.Screen name="MainTabs" component={MainTabs} />
        <RootStack.Screen name="Section" component={SectionScreen} />
        <RootStack.Screen
          name="Platforms"
          component={PlatformsScreen}
          options={{
            headerShown: true, title: "دليل المنصات",
            headerStyle: { backgroundColor: COLORS.bgPure }, headerShadowVisible: false,
            headerTintColor: TH.primary,
            headerTitleStyle: { fontFamily: "Cairo_800ExtraBold", fontSize: 20, color: TH.primary },
            headerTitleAlign: "center",
          }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold,
    Cairo_700Bold, Cairo_800ExtraBold, Cairo_900Black,
  });

  // التحقق من التحديث الهوائي (OTA) — محمي، فشله لا يكسر الإقلاع
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update && update.isAvailable && mounted) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {}
    })();
    return () => { mounted = false; };
  }, []);

  // تسجيل الجهاز + متجر الاشتراكات — محمي + تنظيف
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let uuid = await AsyncStorage.getItem("device_uuid");
        if (!uuid) {
          uuid = "dev_" + Date.now() + "_" + Math.random().toString(36).substring(2, 10);
          await AsyncStorage.setItem("device_uuid", uuid);
        }
        try { await registerDevice(uuid); } catch (e) {}
        const ok = await initStore();
        if (ok && mounted) {
          setupPurchaseListeners(
            uuid,
            () => Alert.alert("تم الاشتراك", "تم تفعيل اشتراكك بنجاح. شكراً لك."),
            () => {}
          );
        }
      } catch (e) {}
    })();
    return () => { mounted = false; try { closeStore(); } catch (e) {} };
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={COLORS.royal} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppInner />
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
