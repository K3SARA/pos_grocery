import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Animated, Platform, Pressable, StyleSheet, Text, View, StatusBar as RNStatusBar } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import CashierScreen from "./src/screens/CashierScreen";
import ProductsScreen from "./src/screens/ProductsScreen";
import SalesScreen from "./src/screens/SalesScreen";
import AdminScreen from "./src/screens/AdminScreen";
import CustomersScreen from "./src/screens/CustomersScreen";
import RoutesScreen from "./src/screens/RoutesScreen";
import CashierDayLogsScreen from "./src/screens/CashierDayLogsScreen";

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const ADMIN_DRAWER_WIDTH = 230;

function TabIcon({ routeName, focused }) {
  const icons = {
    Admin: "speedometer-outline",
    Routes: "map-outline",
    DayLogs: "time-outline",
    Cashier: "receipt-outline",
    Products: "cube-outline",
    Sales: "bar-chart-outline",
    Customers: "people-outline",
  };
  return (
    <Ionicons
      name={icons[routeName] || "ellipse-outline"}
      size={18}
      color={focused ? "#1d4ed8" : "#6b7280"}
    />
  );
}

function HeaderRightLogout() {
  const { logout } = useAuth();

  return (
    <Pressable onPress={logout} style={styles.logoutBtn}>
      <Text style={styles.logoutText}>Logout</Text>
    </Pressable>
  );
}

function CashierTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerRight: () => <HeaderRightLogout />,
        tabBarActiveTintColor: "#1d4ed8",
        tabBarIcon: ({ focused }) => (
          <TabIcon focused={focused} routeName={route.name} />
        ),
      })}
    >
      <Tabs.Screen name="Cashier" component={CashierScreen} />
      <Tabs.Screen name="Products" component={ProductsScreen} />
      <Tabs.Screen name="Customers" component={CustomersScreen} />
      <Tabs.Screen name="Sales" component={SalesScreen} />
    </Tabs.Navigator>
  );
}

function AdminTabs() {
  const { logout } = useAuth();
  const [active, setActive] = React.useState("Admin");
  const [open, setOpen] = React.useState(false);
  const anim = React.useRef(new Animated.Value(0)).current;

  const items = [
    { key: "Admin", label: "Admin Dashboard", icon: "speedometer-outline" },
    { key: "Routes", label: "Routes", icon: "map-outline" },
    { key: "DayLogs", label: "Cashier Day Logs", icon: "time-outline" },
    { key: "Cashier", label: "Cashier", icon: "receipt-outline" },
    { key: "Products", label: "Products", icon: "cube-outline" },
    { key: "Customers", label: "Customers", icon: "people-outline" },
    { key: "Sales", label: "Sales", icon: "bar-chart-outline" },
  ];

  function setDrawer(nextOpen) {
    setOpen(nextOpen);
    Animated.timing(anim, {
      toValue: nextOpen ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }

  function renderActive() {
    switch (active) {
      case "Routes":
        return <RoutesScreen />;
      case "DayLogs":
        return <CashierDayLogsScreen />;
      case "Cashier":
        return <CashierScreen />;
      case "Products":
        return <ProductsScreen />;
      case "Customers":
        return <CustomersScreen />;
      case "Sales":
        return <SalesScreen />;
      case "Admin":
      default:
        return <AdminScreen />;
    }
  }

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-ADMIN_DRAWER_WIDTH, 0],
  });

  return (
    <View style={styles.adminWrap}>
      <View style={styles.adminHeader}>
        <Pressable style={styles.menuBtn} onPress={() => setDrawer(!open)}>
          <Text style={styles.menuBtnText}>...</Text>
        </Pressable>
        <Text style={styles.adminTitle}>Admin</Text>
        <Pressable onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      <View style={styles.adminContent}>{renderActive()}</View>

      {open ? <Pressable style={styles.drawerBackdrop} onPress={() => setDrawer(false)} /> : null}

      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            style={[styles.drawerItem, active === item.key && styles.drawerItemActive]}
            onPress={() => {
              setActive(item.key);
              setDrawer(false);
            }}
          >
            <Ionicons
              name={item.icon}
              size={18}
              color={active === item.key ? "#1d4ed8" : "#1f2937"}
              style={styles.drawerIcon}
            />
            <Text style={[styles.drawerText, active === item.key && styles.drawerTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

function RootNavigator() {
  const { isAuthed, role, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <Text style={styles.loaderText}>Loading session...</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthed ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : role === "admin" ? (
        <Stack.Screen name="AdminTabs" component={AdminTabs} />
      ) : (
        <Stack.Screen name="CashierTabs" component={CashierTabs} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  adminWrap: {
    flex: 1,
    backgroundColor: "#f5f7fb",
  },
  adminHeader: {
    minHeight: 54,
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 10,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuBtn: {
    width: 40,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  menuBtnText: {
    color: "#fff",
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: -2,
  },
  adminTitle: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 18,
  },
  adminContent: {
    flex: 1,
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: ADMIN_DRAWER_WIDTH,
    backgroundColor: "#ffffff",
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    paddingTop: 72,
    paddingHorizontal: 8,
    zIndex: 20,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  drawerItemActive: {
    backgroundColor: "#dbeafe",
  },
  drawerIcon: {
    width: 18,
    color: "#1f2937",
    fontWeight: "700",
  },
  drawerText: {
    color: "#1f2937",
    fontWeight: "600",
  },
  drawerTextActive: {
    color: "#1d4ed8",
  },
  logoutBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#111827",
  },
  logoutText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f7fb",
  },
  loaderText: {
    color: "#374151",
    fontSize: 16,
  },
});
