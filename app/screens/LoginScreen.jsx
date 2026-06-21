import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, 
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../navigation/AppNavigator';

export default function LoginScreen() {
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);

  // Estados del Formulario
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Validación dinámica para el color del botón principal
  const isFormValid = activeTab === 'login' 
    ? email.length > 0 && password.length > 0 
    : name.length > 0 && email.length > 0 && password.length > 0;

  const handleSubmit = async () => {
    if (!isFormValid) return;

    setLoading(true);
    try {
      if (activeTab === 'register') {
        // Registro demo para MVP visual del flujo auth
        Alert.alert('¡Éxito!', 'Cuenta creada. Ahora iniciá sesión.');
        
        // Limpiar formulario
        setActiveTab('login');
        setName('');
        setEmail('');        // ✅ CORREGIDO: Se limpia email
        setPassword('');
      } else {
        // Login demo: habilita el flujo y deja visible el diseño tipo Figma
        const baseName = name.trim() || email.split('@')[0] || 'Usuario';
        const userData = {
          name: baseName.charAt(0).toUpperCase() + baseName.slice(1),
          email,
        };
        login(userData);
      }
    } catch (error) {
      const errorMsg = error.message || 'Ocurrió un error inesperado';
      Alert.alert('Error de autenticación', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const RootContainer = Platform.OS === 'ios' ? KeyboardAvoidingView : View;

  return (
    <RootContainer 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
      >
        
        {/* LOGO E ISOTIPO */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}>
            <Image 
              source={require('../../assets/logo_icon.png')} 
              style={styles.logoImage} 
              resizeMode="contain" 
            />
          </View>
          <Text style={styles.title}>Miti Miti</Text>
          <Text style={styles.subtitle}>Dividí gastos sin complicarte</Text>
        </View>

        {/* CONTROLLER DE PESTAÑAS */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'login' && styles.tabButtonActive]} 
            onPress={() => setActiveTab('login')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'login' && styles.tabButtonTextActive]}>
              Iniciar sesión
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'register' && styles.tabButtonActive]} 
            onPress={() => setActiveTab('register')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'register' && styles.tabButtonTextActive]}>
              Registrarme
            </Text>
          </TouchableOpacity>
        </View>

        {/* FORMULARIO DE INPUTS */}
        <View style={styles.formContainer}>
          {activeTab === 'register' && (
            <View style={styles.inputWrapper}>
              <Ionicons 
                name="person-outline" 
                size={20} 
                color={colors.textSecondary} 
                style={styles.inputIcon} 
              />
              <TextInput
                style={styles.input}
                placeholder="Nombre completo"
                placeholderTextColor="#A4A4A4"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!loading}
              />
            </View>
          )}

          <View style={styles.inputWrapper}>
            <Ionicons 
              name="mail-outline" 
              size={20} 
              color={colors.textSecondary} 
              style={styles.inputIcon} 
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#A4A4A4"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons 
              name="lock-closed-outline" 
              size={20} 
              color={colors.textSecondary} 
              style={styles.inputIcon} 
            />
            <TextInput
              style={styles.input}
              placeholder="Contraseña"
              placeholderTextColor="#A4A4A4"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={secureText}
              autoCapitalize="none"
              editable={!loading}
            />
            <TouchableOpacity 
              onPress={() => setSecureText(!secureText)} 
              style={styles.eyeIcon}
            >
              <Ionicons 
                name={secureText ? "eye-outline" : "eye-off-outline"} 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>
          </View>

          {activeTab === 'login' && (
            <TouchableOpacity style={styles.forgotBtn}>
              <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* BOTÓN PRINCIPAL */}
        <TouchableOpacity 
          style={[
            styles.btnPrimary, 
            { backgroundColor: isFormValid && !loading ? colors.primary : '#BCCCDC' }
          ]} 
          onPress={handleSubmit}
          disabled={!isFormValid || loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.btnPrimaryText}>
              {activeTab === 'login' ? 'Iniciar sesión' : 'Registrarme'}
            </Text>
          )}
        </TouchableOpacity>

        {/* FOOTER TOGGLE */}
        <TouchableOpacity 
          style={styles.footerToggle} 
          onPress={() => setActiveTab(activeTab === 'login' ? 'register' : 'login')}
          disabled={loading}
        >
          <Text style={styles.footerSubText}>
            {activeTab === 'login' ? '¿Sin cuenta? ' : '¿Ya tenés cuenta? '}
            <Text style={styles.footerActionText}>
              {activeTab === 'login' ? 'Registrate' : 'Iniciá sesión'}
            </Text>
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </RootContainer>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: Platform.OS === 'ios' ? 'center' : undefined,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 75 : 40,
    paddingBottom: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBox: {
    width: 84,
    height: 84,
    backgroundColor: '#f9f7e2', 
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 25,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#EAE7F0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabButtonTextActive: {
    color: 'white',
  },
  formContainer: {
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAE7F0',
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: colors.textPrimary,
  },
  eyeIcon: {
    padding: 4,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  forgotText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  btnPrimary: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  btnPrimaryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerToggle: {
    alignItems: 'center',
    marginTop: 8,
  },
  footerSubText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  footerActionText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
});