import React, { useEffect } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Alert, Platform, StatusBar, I18nManager, View, ActivityIndicator } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts, Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold } from "@expo-google-fonts/tajawal";
import { Cairo_700Bold, Cairo_800ExtraBold, Cairo_900Black } from "@expo-google-fonts/cairo";

import HomeScreen from "./src/screens/HomeScreen";
import SectionScreen from "./src/screens/SectionScreen";
import SubscriptionScreen from "./src/screens/SubscriptionScreen";
import PlatformsScreen from "./src/screens/PlatformsScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import { COLORS, THEMES, DEFAULT_THEME } from "./src/lib/theme";
import { registerDevice } from "./src/lib/api";
import { initStore, closeStore, setupPurchaseListeners } from "./src/lib/payments";

// فرض الاتجاه من اليمين لليسار (RTL) من جذر التطبيق
try {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
  I18nManager.swapLeftAndRightInRTL(true);
} catch (e) {}

const TH = THEMES[DEFAULT_THEME];
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.bg,
    card: COLORS.bgPure,
    text: COLORS.onyx,
    border: COLORS.border,
    primary: COLORS.royal,
  },
};

function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.bgPure },
        headerShadowVisible: false,
        headerTintColor: COLORS.royal,
        headerTitleStyle: { fontFamily: "Cairo_800ExtraBold", fontSize: 20, color: COLORS.royal },
        headerTitleAlign: "center",
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Section" component={SectionScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Platforms" component={PlatformsScreen} options={{ title: "دليل المنصات" }} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold,
    Cairo_700Bold, Cairo_800ExtraBold, Cairo_900Black,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
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
    })();
    return () => { mounted = false; closeStore(); };
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={COLORS.royal} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={NavTheme}>
      <StatusBar barStyle="light-content" backgroundColor={TH.g1} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: COLORS.bgPure },
          headerShadowVisible: false,
          headerTintColor: COLORS.royal,
          headerTitleStyle: { fontFamily: "Cairo_800ExtraBold", color: COLORS.royal, fontSize: 19 },
          headerTitleAlign: "center",
          tabBarStyle: {
            position: "absolute",
            bottom: Platform.OS === "ios" ? 28 : 18,
            left: 20, right: 20, height: 66, borderRadius: 26,
            backgroundColor: TH.g2,
            borderWidth: 0,
            borderTopWidth: 0,
            shadowColor: "#0F5132", shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.28, shadowRadius: 20, elevation: 12,
            paddingBottom: Platform.OS === "ios" ? 16 : 10, paddingTop: 10,
          },
          tabBarActiveTintColor: TH.accentLite,
          tabBarInactiveTintColor: "rgba(255,255,255,0.55)",
          tabBarLabelStyle: { fontFamily: "Cairo_700Bold", fontSize: 11 },
          tabBarIcon: ({ color, focused }) => {
            const icons = {
              الرئيسية: "home",
              "المساعد التقديري": "calculator",
              الاشتراكات: "crown",
              حسابي: "user",
            };
            return (
              <View style={styles.tabIconWrapper}>
                <FontAwesome5 name={icons[route.name] || "circle"} size={18} color={color} solid={focused} />
                {focused && <View style={styles.activeDot} />}
              </View>
            );
          },
        })}
      >
        <Tab.Screen name="الرئيسية" component={HomeStack} options={{ headerShown: false }} />
        <Tab.Screen name="المساعد التقديري" component={SectionScreen} options={{ title: "المساعد التقديري" }} />
        <Tab.Screen name="الاشتراكات" component={SubscriptionScreen} options={{ title: "الاشتراكات" }} />
        <Tab.Screen name="حسابي" component={SettingsScreen} options={{ title: "حسابي" }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = {
  tabIconWrapper: { alignItems: "center", justifyContent: "center" },
  activeDot: {
    width: 5, height: 5, borderRadius: 2.5, backgroundColor: TH.accentLite, marginTop: 4,
  },
};
